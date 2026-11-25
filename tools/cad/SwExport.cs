// SwExport — read-only SOLIDWORKS export helper for the portfolio CAD pipeline.
//
// Attaches to a SOLIDWORKS session the user has started (it never launches one),
// opens models READ-ONLY, and never saves a model back. Only "Save As Copy" to
// new image/mesh files under tools/cad/out is ever called.
//
// Commands (all paths absolute):
//   probe
//   audit   --src <file> --out <csv>
//   render  --src <file> --outdir <dir> --views "iso=*Isometric;hero=*Trimetric@0,30"
//           [--exclude <txt>] [--width 2560] [--height 1600] [--method bmp|print|both]
//           [--supersample 2] [--zoom 1.0]
//           [--realview 1] [--edges 0]
//   glb     --src <file> --out <file.glb> [--exclude <txt>] [--tess keep|coarse|x<factor>]
//   close   --src <file>
//   part    --part <referenced part path> [--out <file.glb|.stl|.3mf>]
//           (lists bodies of a part already open through an assembly; optional Save-As-Copy)
//   restore-settings
//
// System settings that are touched are written to out/sw-settings-backup.txt at the
// start and restored in a finally block (and on the next run if a run was killed).
//
// C# 5 (csc.exe from .NET Framework 4.x). Build with build.cmd.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using SolidWorks.Interop.sldworks;
using SolidWorks.Interop.swconst;

namespace SwExport
{
    // ---------------------------------------------------------------- COM retry filter
    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("00000016-0000-0000-C000-000000000046")]
    interface IOleMessageFilter
    {
        [PreserveSig] int HandleInComingCall(int dwCallType, IntPtr hTaskCaller, int dwTickCount, IntPtr lpInterfaceInfo);
        [PreserveSig] int RetryRejectedCall(IntPtr hTaskCallee, int dwTickCount, int dwRejectType);
        [PreserveSig] int MessagePending(IntPtr hTaskCallee, int dwTickCount, int dwPendingType);
    }

    class MessageFilter : IOleMessageFilter
    {
        [DllImport("Ole32.dll")]
        static extern int CoRegisterMessageFilter(IOleMessageFilter newFilter, out IOleMessageFilter oldFilter);

        public static void Register() { IOleMessageFilter old; CoRegisterMessageFilter(new MessageFilter(), out old); }
        public static void Revoke() { IOleMessageFilter old; CoRegisterMessageFilter(null, out old); }

        public int HandleInComingCall(int dwCallType, IntPtr hTaskCaller, int dwTickCount, IntPtr lpInterfaceInfo) { return 0; }
        // SERVERCALL_RETRYLATER = 2: SOLIDWORKS is busy, retry every 250 ms for up to 30 min.
        public int RetryRejectedCall(IntPtr hTaskCallee, int dwTickCount, int dwRejectType)
        {
            if (dwRejectType == 2 && dwTickCount < 30 * 60 * 1000) return 250;
            return -1;
        }
        public int MessagePending(IntPtr hTaskCallee, int dwTickCount, int dwPendingType) { return 2; }
    }

    // ---------------------------------------------------------------- system settings guard
    class Prefs
    {
        readonly ISldWorks app;
        readonly string backupPath;
        readonly Dictionary<int, int> ints = new Dictionary<int, int>();
        readonly Dictionary<int, double> dbls = new Dictionary<int, double>();
        readonly Dictionary<int, bool> toggles = new Dictionary<int, bool>();

        // Every system preference this program may change.
        static readonly int[] IntIds = {
            (int)swUserPreferenceIntegerValue_e.swColorsBackgroundAppearance,
            (int)swUserPreferenceIntegerValue_e.swSystemColorsViewportBackground,
            (int)swUserPreferenceIntegerValue_e.swTiffScreenOrPrintCapture,
            (int)swUserPreferenceIntegerValue_e.swTiffImageType,
            (int)swUserPreferenceIntegerValue_e.swTiffCompressionScheme,
            (int)swUserPreferenceIntegerValue_e.swTiffPrintDPI,
            (int)swUserPreferenceIntegerValue_e.swTiffPrintPaperSize,
            (int)swUserPreferenceIntegerValue_e.swTiffPrintScaleFactor,
        };
        static readonly int[] DblIds = {
            (int)swUserPreferenceDoubleValue_e.swTiffPrintPaperWidth,
            (int)swUserPreferenceDoubleValue_e.swTiffPrintPaperHeight,
        };
        static readonly int[] ToggleIds = {
            (int)swUserPreferenceToggle_e.swColorsGradientPartBackground,
            (int)swUserPreferenceToggle_e.swDisplayShadowsInShadedMode,
            (int)swUserPreferenceToggle_e.swDisplayAmbientOcclusionShadows,
            (int)swUserPreferenceToggle_e.swDisplayRealViewGraphics,
            (int)swUserPreferenceToggle_e.swTiffPrintScaleToFit,
        };

        public Prefs(ISldWorks app, string backupPath)
        {
            this.app = app;
            this.backupPath = backupPath;
            if (File.Exists(backupPath))
            {
                Console.WriteLine("Found a settings backup from an interrupted run; restoring it first.");
                RestoreFromFile();
            }
            foreach (int id in IntIds) ints[id] = app.GetUserPreferenceIntegerValue(id);
            foreach (int id in DblIds) dbls[id] = app.GetUserPreferenceDoubleValue(id);
            foreach (int id in ToggleIds) toggles[id] = app.GetUserPreferenceToggle(id);
            var sb = new StringBuilder();
            foreach (var kv in ints) sb.AppendLine("i " + kv.Key + " " + kv.Value);
            foreach (var kv in dbls) sb.AppendLine("d " + kv.Key + " " + kv.Value.ToString("R", CultureInfo.InvariantCulture));
            foreach (var kv in toggles) sb.AppendLine("t " + kv.Key + " " + (kv.Value ? 1 : 0));
            Directory.CreateDirectory(Path.GetDirectoryName(backupPath));
            File.WriteAllText(backupPath, sb.ToString());
        }

        public void SetInt(swUserPreferenceIntegerValue_e id, int v) { Check(ints, (int)id); app.SetUserPreferenceIntegerValue((int)id, v); }
        public void SetDouble(swUserPreferenceDoubleValue_e id, double v) { Check(dbls, (int)id); app.SetUserPreferenceDoubleValue((int)id, v); }
        public void SetToggle(swUserPreferenceToggle_e id, bool v) { Check(toggles, (int)id); app.SetUserPreferenceToggle((int)id, v); }

        static void Check<T>(Dictionary<int, T> d, int id)
        {
            if (!d.ContainsKey(id)) throw new InvalidOperationException("Preference " + id + " is not in the backed-up list");
        }

        public void Restore()
        {
            foreach (var kv in ints) app.SetUserPreferenceIntegerValue(kv.Key, kv.Value);
            foreach (var kv in dbls) app.SetUserPreferenceDoubleValue(kv.Key, kv.Value);
            foreach (var kv in toggles) app.SetUserPreferenceToggle(kv.Key, kv.Value);
            File.Delete(backupPath);
            Console.WriteLine("System settings restored.");
        }

        public static void RestoreFromFile(ISldWorks app, string path)
        {
            foreach (string line in File.ReadAllLines(path))
            {
                string[] p = line.Split(' ');
                if (p.Length != 3) continue;
                int id = int.Parse(p[1], CultureInfo.InvariantCulture);
                if (p[0] == "i") app.SetUserPreferenceIntegerValue(id, int.Parse(p[2], CultureInfo.InvariantCulture));
                else if (p[0] == "d") app.SetUserPreferenceDoubleValue(id, double.Parse(p[2], CultureInfo.InvariantCulture));
                else if (p[0] == "t") app.SetUserPreferenceToggle(id, p[2] == "1");
            }
            File.Delete(path);
        }

        void RestoreFromFile() { RestoreFromFile(app, backupPath); }
    }

    // ---------------------------------------------------------------- program
    static class Program
    {
        static ISldWorks app;
        static Dictionary<string, string> opt = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        [STAThread]
        static int Main(string[] args)
        {
            if (args.Length == 0) { Console.Error.WriteLine("usage: SwExport <probe|audit|render|glb|close|restore-settings> [--key value ...]"); return 2; }
            for (int i = 1; i + 1 < args.Length; i += 2)
            {
                if (!args[i].StartsWith("--")) { Console.Error.WriteLine("bad argument: " + args[i]); return 2; }
                opt[args[i].Substring(2)] = args[i + 1];
            }
            MessageFilter.Register();
            try
            {
                return Run(args[0].ToLowerInvariant());
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("ERROR: " + ex);
                return 1;
            }
            finally
            {
                MessageFilter.Revoke();
            }
        }

        static string Opt(string k, string def)
        {
            string v;
            return opt.TryGetValue(k, out v) ? v : def;
        }

        static string Req(string k)
        {
            string v;
            if (!opt.TryGetValue(k, out v)) throw new ArgumentException("missing --" + k);
            return v;
        }

        static string OutDir()
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;           // tools/cad/out/bin/
            return Path.GetFullPath(Path.Combine(exeDir, ".."));               // tools/cad/out/
        }

        static int Run(string cmd)
        {
            try
            {
                app = (ISldWorks)Marshal.GetActiveObject("SldWorks.Application");
            }
            catch (COMException)
            {
                Console.Error.WriteLine("No running SOLIDWORKS session found. Start SOLIDWORKS 2025, clear its start-up dialogs, then retry.");
                return 3;
            }
            Console.WriteLine("Attached to SOLIDWORKS " + app.RevisionNumber());
            string backup = Path.Combine(OutDir(), "sw-settings-backup.txt");

            if (cmd == "restore-settings")
            {
                if (File.Exists(backup)) { Prefs.RestoreFromFile(app, backup); Console.WriteLine("Restored."); }
                else Console.WriteLine("No backup file; nothing to restore.");
                return 0;
            }

            Prefs prefs = new Prefs(app, backup);
            try
            {
                switch (cmd)
                {
                    case "probe": Probe(); return 0;
                    case "audit": Audit(Open(Req("src")), Req("src"), Req("out")); return 0;
                    case "render": return Render(Open(Req("src")), prefs);
                    case "glb": return Glb(Open(Req("src")));
                    case "close": Close(Req("src")); return 0;
                    case "part": return PartExport();
                    case "tess":
                        // --attach 1: read from a document the user already has open (any mode),
                        // without reopening or changing its read-only state; tess only reads geometry.
                        if (Opt("attach", "0") == "1")
                        {
                            ModelDoc2 open = FindOpen(Req("src"));
                            if (open == null) throw new Exception("Not open in SOLIDWORKS: " + Req("src"));
                            return Tess(open);
                        }
                        return Tess(Open(Req("src")));
                    case "mates": return Mates(Req("src"), Opt("comp", "joint13"));
                    default: Console.Error.WriteLine("unknown command " + cmd); return 2;
                }
            }
            finally
            {
                prefs.Restore();
            }
        }

        // ------------------------------------------------------------ open / close (read-only)
        static bool IsParasolid(string src)
        {
            string e = Path.GetExtension(src).ToLowerInvariant();
            return e == ".x_t" || e == ".x_b";
        }

        static ModelDoc2 FindOpen(string src)
        {
            object[] docs = (object[])app.GetDocuments();
            if (docs == null) return null;
            string stem = Path.GetFileNameWithoutExtension(src);
            foreach (object o in docs)
            {
                ModelDoc2 d = (ModelDoc2)o;
                string p = d.GetPathName() ?? "";
                if (string.Equals(p, src, StringComparison.OrdinalIgnoreCase)) return d;
                // A Parasolid import is an unsaved, in-memory document titled after the file
                // (e.g. final_configuration.sldasm); its path may be pre-filled but never exists on disk.
                if (IsParasolid(src) && d.GetTitle().StartsWith(stem, StringComparison.OrdinalIgnoreCase) && (p == "" || !File.Exists(p))) return d;
            }
            return null;
        }

        static ModelDoc2 Open(string src)
        {
            if (!File.Exists(src)) throw new FileNotFoundException(src);
            ModelDoc2 doc = FindOpen(src);
            int err = 0, warn = 0;
            if (doc == null)
            {
                DateTime t0 = DateTime.Now;
                if (IsParasolid(src))
                {
                    object imp = app.GetImportFileData(src);
                    doc = (ModelDoc2)app.LoadFile4(src, "r", imp, ref err);
                    if (doc == null) throw new Exception("LoadFile4 failed, error " + err);
                }
                else
                {
                    int type = Path.GetExtension(src).ToLowerInvariant() == ".sldasm"
                        ? (int)swDocumentTypes_e.swDocASSEMBLY : (int)swDocumentTypes_e.swDocPART;
                    int options = (int)(swOpenDocOptions_e.swOpenDocOptions_Silent
                                        | swOpenDocOptions_e.swOpenDocOptions_ReadOnly
                                        | swOpenDocOptions_e.swOpenDocOptions_OverrideDefaultLoadLightweight);
                    doc = (ModelDoc2)app.OpenDoc6(src, type, options, "", ref err, ref warn);
                    if (doc == null) throw new Exception("OpenDoc6 failed, error " + err + " warning " + warn);
                }
                Console.WriteLine("Opened " + doc.GetTitle() + " in " + (DateTime.Now - t0).TotalSeconds.ToString("0") + " s (err " + err + ", warn " + warn + ")");
            }
            else Console.WriteLine("Reusing open document " + doc.GetTitle());

            if (!IsParasolid(src) && !doc.IsOpenedReadOnly())
                throw new Exception("Document is open but NOT read-only. Close it in SOLIDWORKS and rerun so it can be reopened read-only.");

            app.ActivateDoc3(doc.GetTitle(), false, (int)swRebuildOnActivation_e.swDontRebuildActiveDoc, ref err);
            if (doc.GetType() == (int)swDocumentTypes_e.swDocASSEMBLY)
            {
                AssemblyDoc asm = (AssemblyDoc)doc;
                int n = asm.GetLightWeightComponentCount();
                if (n > 0)
                {
                    Console.WriteLine("Resolving " + n + " lightweight components...");
                    asm.ResolveAllLightWeightComponents(false);
                }
            }
            LockAllReadOnly();
            return doc;
        }

        // OpenDoc6(ReadOnly) only marks the top-level file read-only; the parts and
        // sub-assemblies it loads are opened writable. Lock every open document on disk
        // so nothing can be saved back, even by an accidental Ctrl+S in the GUI.
        static void LockAllReadOnly()
        {
            object[] docs = (object[])app.GetDocuments();
            if (docs == null) return;
            int locked = 0, failed = 0;
            foreach (object o in docs)
            {
                ModelDoc2 d = (ModelDoc2)o;
                string p = d.GetPathName() ?? "";
                // Never-saved documents (the in-memory Parasolid import) cannot be made read-only;
                // they have no file on disk to overwrite, and this program never saves them.
                if (p == "" || !File.Exists(p) || d.IsOpenedReadOnly()) continue;
                if (d.SetReadOnlyState(true) && d.IsOpenedReadOnly()) locked++; else failed++;
            }
            if (locked > 0 || failed > 0) Console.WriteLine("Locked " + locked + " referenced documents read-only" + (failed > 0 ? " (" + failed + " FAILED)" : ""));
        }

        static void Close(string src)
        {
            ModelDoc2 doc = FindOpen(src);
            if (doc == null) { Console.WriteLine("Not open: " + src); return; }
            string title = doc.GetTitle();
            app.QuitDoc(title);   // closes WITHOUT saving
            Console.WriteLine("Closed without saving: " + title);
        }

        // ------------------------------------------------------------ probe
        static void Probe()
        {
            object[] docs = (object[])app.GetDocuments();
            Console.WriteLine("Open documents: " + (docs == null ? 0 : docs.Length));
            if (docs != null)
                foreach (object o in docs)
                {
                    ModelDoc2 d = (ModelDoc2)o;
                    Console.WriteLine("  " + d.GetTitle() + " | " + d.GetPathName() + " | readonly=" + d.IsOpenedReadOnly());
                }
            Console.WriteLine("Background appearance = " + app.GetUserPreferenceIntegerValue((int)swUserPreferenceIntegerValue_e.swColorsBackgroundAppearance));
            Console.WriteLine("RealView system toggle = " + app.GetUserPreferenceToggle((int)swUserPreferenceToggle_e.swDisplayRealViewGraphics));
            Console.WriteLine("Image export: printCapture=" + app.GetUserPreferenceIntegerValue((int)swUserPreferenceIntegerValue_e.swTiffScreenOrPrintCapture)
                + " dpi=" + app.GetUserPreferenceIntegerValue((int)swUserPreferenceIntegerValue_e.swTiffPrintDPI)
                + " paper=" + app.GetUserPreferenceIntegerValue((int)swUserPreferenceIntegerValue_e.swTiffPrintPaperSize)
                + " w=" + app.GetUserPreferenceDoubleValue((int)swUserPreferenceDoubleValue_e.swTiffPrintPaperWidth)
                + " h=" + app.GetUserPreferenceDoubleValue((int)swUserPreferenceDoubleValue_e.swTiffPrintPaperHeight));
        }

        // ------------------------------------------------------------ audit
        class FileFacts
        {
            public string Kind = "", Imported = "", ImportedFeatures = "", FeatureTypes = "", Bodies = "", Author = "", Created = "", Saved = "";
        }

        static readonly HashSet<string> BoringFeatureTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
            "HistoryFolder","SensorFolder","DocsFolder","DetailCabinet","SurfaceBodyFolder","SolidBodyFolder","CommentsFolder",
            "FavoriteFolder","SelectionSetFolder","EnvFolder","InkMarkupFolder","EqnFolder","LiveSectionFolder","MaterialFolder",
            "RefPlane","OriginProfileFeature","MateGroup","MateReferenceGroupFolder","BlockFolder","AmbientLight","DirectionLight",
            "PointLight","SpotLight","CameraFolder","ProfileFeature","Reference","FtrFolder","DisplayStateFolder","RefAxis",
            "Attribute","GridFeature","CutListFolder","SubWeldFolder","MagneticGroundPlane","DimXpertFolder","GhostFolder",
            "RefPoint","ExplodeFolder","CoordSys","EditFeatureFolder","BodyFeatureFolder","SketchBlockDef","SketchBlockInst"
        };

        static FileFacts Facts(ModelDoc2 md, string path, Dictionary<string, FileFacts> cache)
        {
            FileFacts f;
            string key = string.IsNullOrEmpty(path) ? "(unsaved)" : path.ToLowerInvariant();
            if (cache.TryGetValue(key, out f)) return f;
            f = new FileFacts();
            cache[key] = f;
            if (md == null) { f.Kind = "unloaded"; return f; }
            int t = md.GetType();
            f.Kind = t == (int)swDocumentTypes_e.swDocASSEMBLY ? "asm" : t == (int)swDocumentTypes_e.swDocPART ? "part" : "other";
            try
            {
                f.Author = md.get_SummaryInfo((int)swSummInfoField_e.swSumInfoAuthor) ?? "";
                f.Created = md.get_SummaryInfo((int)swSummInfoField_e.swSumInfoCreateDate) ?? "";
                f.Saved = md.get_SummaryInfo((int)swSummInfoField_e.swSumInfoSaveDate) ?? "";
            }
            catch { }
            if (t != (int)swDocumentTypes_e.swDocPART) return f;

            var types = new SortedDictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var imported = new List<string>();
            Feature feat = (Feature)md.FirstFeature();
            while (feat != null)
            {
                string ty = feat.GetTypeName2() ?? "";
                string nm = feat.Name ?? "";
                if (!BoringFeatureTypes.Contains(ty))
                {
                    int c; types.TryGetValue(ty, out c); types[ty] = c + 1;
                }
                if (ty.IndexOf("Import", StringComparison.OrdinalIgnoreCase) >= 0
                    || ty.Equals("BaseBody", StringComparison.OrdinalIgnoreCase)
                    || ty.IndexOf("Mesh", StringComparison.OrdinalIgnoreCase) >= 0
                    || nm.StartsWith("Imported", StringComparison.OrdinalIgnoreCase)
                    || nm.StartsWith("Graphics", StringComparison.OrdinalIgnoreCase))
                    imported.Add(nm + "<" + ty + ">");
                feat = (Feature)feat.GetNextFeature();
            }
            f.Imported = imported.Count > 0 ? "yes" : "no";
            f.ImportedFeatures = string.Join(" ", imported.Take(6)) + (imported.Count > 6 ? " +" + (imported.Count - 6) : "");
            f.FeatureTypes = string.Join(" ", types.Select(kv => kv.Key + "x" + kv.Value));
            try
            {
                object[] bodies = (object[])((PartDoc)md).GetBodies2((int)swBodyType_e.swAllBodies, false);
                f.Bodies = bodies == null ? "0" : bodies.Length.ToString();
            }
            catch { }
            return f;
        }

        static string Csv(string s)
        {
            s = s ?? "";
            if (s.IndexOfAny(new[] { ',', '"', '\n', '\r' }) >= 0) return "\"" + s.Replace("\"", "\"\"") + "\"";
            return s;
        }

        static string SupName(int s)
        {
            switch (s)
            {
                case 0: return "suppressed";
                case 1: return "lightweight";
                case 2: return "fully-resolved";
                case 3: return "resolved";
                case 4: return "fully-lightweight";
                default: return "state" + s;
            }
        }

        static void Audit(ModelDoc2 doc, string src, string outCsv)
        {
            var cache = new Dictionary<string, FileFacts>();
            var lines = new List<string>();
            lines.Add("depth,component,parent,file,kind,suppression,hidden,imported,imported_features,feature_types,bodies,author,created,saved");

            if (doc.GetType() == (int)swDocumentTypes_e.swDocASSEMBLY)
            {
                object[] comps = (object[])((AssemblyDoc)doc).GetComponents(false);
                var list = comps == null ? new List<Component2>() : comps.Cast<Component2>().ToList();
                list.Sort((a, b) => string.Compare(a.Name2, b.Name2, StringComparison.OrdinalIgnoreCase));
                foreach (Component2 c in list)
                {
                    string name = c.Name2 ?? "";
                    string path = c.GetPathName() ?? "";
                    Component2 parent = (Component2)c.GetParent();
                    int sup = c.GetSuppression2();
                    ModelDoc2 md = sup == 0 ? null : (ModelDoc2)c.GetModelDoc2();
                    FileFacts f = Facts(md, path, cache);
                    lines.Add(string.Join(",", new[] {
                        name.Count(ch => ch == '/').ToString(), Csv(name), Csv(parent == null ? "" : parent.Name2), Csv(path),
                        f.Kind, SupName(sup), c.IsHidden(false) ? "yes" : "no", f.Imported, Csv(f.ImportedFeatures),
                        Csv(f.FeatureTypes), f.Bodies, Csv(f.Author), Csv(f.Created), Csv(f.Saved) }));
                }
                Console.WriteLine("Components: " + list.Count + ", unique files: " + cache.Count);
            }
            else
            {
                // Imported Parasolid part: list its bodies.
                FileFacts f = Facts(doc, src, cache);
                object[] bodies = (object[])((PartDoc)doc).GetBodies2((int)swBodyType_e.swAllBodies, false);
                if (bodies != null)
                    foreach (Body2 b in bodies)
                    {
                        object[] faces = (object[])b.GetFaces();
                        lines.Add(string.Join(",", new[] {
                            "0", Csv(b.Name), "", Csv(src), "body(type " + b.GetType() + ", faces " + (faces == null ? 0 : faces.Length) + ")",
                            "", b.Visible ? "no" : "yes", f.Imported, Csv(f.ImportedFeatures), Csv(f.FeatureTypes), "1", "", "", "" }));
                    }
                Console.WriteLine("Bodies: " + (bodies == null ? 0 : bodies.Length));
            }
            Directory.CreateDirectory(Path.GetDirectoryName(outCsv));
            File.WriteAllLines(outCsv, lines, new UTF8Encoding(true));
            Console.WriteLine("Wrote " + outCsv);
        }

        // ------------------------------------------------------------ exclusions
        static List<Regex> LoadExclusions()
        {
            var res = new List<Regex>();
            string file = Opt("exclude", "");
            if (file == "" || !File.Exists(file)) return res;
            foreach (string raw in File.ReadAllLines(file))
            {
                string line = raw.Trim();
                if (line == "" || line.StartsWith("#")) continue;
                string rx = "^" + Regex.Escape(line).Replace("\\*", ".*").Replace("\\?", ".") + "$";
                res.Add(new Regex(rx, RegexOptions.IgnoreCase));
            }
            return res;
        }

        static bool Matches(List<Regex> ex, Component2 c)
        {
            string name = c.Name2 ?? "";
            string leaf = name.Contains("/") ? name.Substring(name.LastIndexOf('/') + 1) : name;
            string path = c.GetPathName() ?? "";
            string file = Path.GetFileName(path);
            foreach (Regex r in ex)
                if (r.IsMatch(name) || r.IsMatch(leaf) || r.IsMatch(file) || r.IsMatch(path)) return true;
            return false;
        }

        // Suppress (in memory only) every component matching the exclusion list.
        static void ApplyExclusions(ModelDoc2 doc)
        {
            var ex = LoadExclusions();
            if (ex.Count == 0 || doc.GetType() != (int)swDocumentTypes_e.swDocASSEMBLY) return;
            object[] comps = (object[])((AssemblyDoc)doc).GetComponents(false);
            int n = 0;
            foreach (Component2 c in comps.Cast<Component2>().OrderBy(c => c.Name2.Length))
            {
                if (c.GetSuppression2() == 0 || !Matches(ex, c)) continue;
                int r = c.SetSuppression2((int)swComponentSuppressionState_e.swComponentSuppressed);
                if (c.GetSuppression2() != 0)
                {
                    c.Visible = (int)swComponentVisibilityState_e.swComponentHidden;
                    Console.WriteLine("  hid (suppress returned " + r + "): " + c.Name2);
                }
                n++;
            }
            doc.EditRebuild3();
            Console.WriteLine("Excluded " + n + " components (in memory only).");
        }

        // ------------------------------------------------------------ render
        static int Render(ModelDoc2 doc, Prefs prefs)
        {
            string outDir = Req("outdir");
            Directory.CreateDirectory(outDir);
            int width = int.Parse(Opt("width", "2560"));
            int height = int.Parse(Opt("height", "1600"));
            string method = Opt("method", "bmp");
            int ss = int.Parse(Opt("supersample", "2"));
            double zoom = double.Parse(Opt("zoom", "1"), CultureInfo.InvariantCulture);
            bool wantRealView = Opt("realview", "1") == "1";
            bool edges = Opt("edges", "0") == "1";

            ApplyExclusions(doc);
            ModelDocExtension ext = doc.Extension;

            // Document display (in memory only, never saved).
            ext.SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swViewDisplayHideAllTypes, (int)swUserPreferenceOption_e.swDetailingNoOptionSpecified, true);
            ext.SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swDisplayShadowsInShadedMode, (int)swUserPreferenceOption_e.swDetailingNoOptionSpecified, false);
            doc.ViewDisplayShaded();
            ModelView mv = (ModelView)doc.ActiveView;
            if (edges) mv.DisplayMode = (int)swViewDisplayMode_e.swViewDisplayMode_ShadedWithEdges;
            if (mv.HasPerspective()) mv.RemovePerspective();

            // System display: plain white background, no gradient, no floor shadows.
            prefs.SetInt(swUserPreferenceIntegerValue_e.swColorsBackgroundAppearance, (int)swColorsBackgroundAppearance_e.swColorsBackgroundAppearance_Plain);
            prefs.SetInt(swUserPreferenceIntegerValue_e.swSystemColorsViewportBackground, 0xFFFFFF);
            prefs.SetToggle(swUserPreferenceToggle_e.swColorsGradientPartBackground, false);
            prefs.SetToggle(swUserPreferenceToggle_e.swDisplayShadowsInShadedMode, false);

            // RealView + ambient occlusion, with fallback to plain shaded.
            bool realView = false;
            if (wantRealView)
            {
                try
                {
                    prefs.SetToggle(swUserPreferenceToggle_e.swDisplayRealViewGraphics, true);
                    ext.ViewDisplayRealView = true;
                    realView = ext.ViewDisplayRealView;
                }
                catch (Exception e) { Console.WriteLine("RealView unavailable: " + e.Message); }
            }
            else
            {
                try { ext.ViewDisplayRealView = false; } catch { }
            }
            prefs.SetToggle(swUserPreferenceToggle_e.swDisplayAmbientOcclusionShadows, realView);
            Console.WriteLine("RealView: " + (realView ? "on (+ambient occlusion)" : "off (plain shaded)"));

            // Print-capture image export at exactly width x height px.
            const int dpi = 300;
            prefs.SetInt(swUserPreferenceIntegerValue_e.swTiffScreenOrPrintCapture, 1);
            prefs.SetInt(swUserPreferenceIntegerValue_e.swTiffImageType, (int)swTiffImageType_e.swTiffImageRGB);
            prefs.SetInt(swUserPreferenceIntegerValue_e.swTiffPrintDPI, dpi);
            prefs.SetInt(swUserPreferenceIntegerValue_e.swTiffPrintPaperSize, (int)swDwgPaperSizes_e.swDwgPapersUserDefined);
            prefs.SetDouble(swUserPreferenceDoubleValue_e.swTiffPrintPaperWidth, width / (double)dpi * 0.0254);
            prefs.SetDouble(swUserPreferenceDoubleValue_e.swTiffPrintPaperHeight, height / (double)dpi * 0.0254);
            prefs.SetToggle(swUserPreferenceToggle_e.swTiffPrintScaleToFit, true);

            int failures = 0;
            foreach (string spec in Req("views").Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                // name=*NamedView[@rotX,rotY][#zoom]  (degrees about screen axes after the named view;
                // zoom overrides --zoom for this view)
                string[] kv = spec.Split('=');
                string name = kv[0].Trim();
                string view = kv[1].Trim();
                double rx = 0, ry = 0;
                double vzoom = zoom;
                int hash = view.IndexOf('#');
                if (hash >= 0)
                {
                    vzoom = double.Parse(view.Substring(hash + 1), CultureInfo.InvariantCulture);
                    view = view.Substring(0, hash);
                }
                int at = view.IndexOf('@');
                if (at >= 0)
                {
                    string[] r = view.Substring(at + 1).Split(',');
                    rx = double.Parse(r[0], CultureInfo.InvariantCulture);
                    ry = double.Parse(r[1], CultureInfo.InvariantCulture);
                    view = view.Substring(0, at);
                }
                doc.ShowNamedView2(view, -1);
                mv = (ModelView)doc.ActiveView;
                if (rx != 0 || ry != 0) mv.RotateAboutCenter(rx * Math.PI / 180, ry * Math.PI / 180);
                doc.ViewZoomtofit2();
                mv = (ModelView)doc.ActiveView;
                if (vzoom != 1) mv.ZoomByFactor(vzoom);
                doc.GraphicsRedraw2();

                bool ok = false;
                if (method == "print" || method == "both")
                {
                    string png = Path.Combine(outDir, name + ".print.png");
                    if (File.Exists(png)) File.Delete(png);
                    int e = 0, w = 0;
                    bool r = ext.SaveAs3(png, (int)swSaveAsVersion_e.swSaveAsCurrentVersion,
                        (int)(swSaveAsOptions_e.swSaveAsOptions_Silent | swSaveAsOptions_e.swSaveAsOptions_Copy), null, null, ref e, ref w);
                    ok = r && File.Exists(png) && new FileInfo(png).Length > 0;
                    Console.WriteLine("  " + name + ": print-capture PNG " + (ok ? "ok" : "FAILED (err " + e + ", warn " + w + ")"));
                }
                if (method == "bmp" || method == "both" || !ok)
                {
                    string bmp = Path.Combine(outDir, name + ".bmp");
                    if (File.Exists(bmp)) File.Delete(bmp);
                    bool r = doc.SaveBMP(bmp, width * ss, height * ss);
                    bool okb = r && File.Exists(bmp);
                    Console.WriteLine("  " + name + ": SaveBMP " + (okb ? "ok" : "FAILED"));
                    ok = ok || okb;
                }
                if (!ok) failures++;
            }
            return failures == 0 ? 0 : 4;
        }

        // ------------------------------------------------------------ part (diagnose / fallback export)
        static int PartExport()
        {
            string partPath = Req("part");
            ModelDoc2 doc = FindOpen(partPath);
            if (doc == null) throw new Exception("Part is not open (open its assembly first): " + partPath);
            if (doc.GetType() == (int)swDocumentTypes_e.swDocPART)
            {
                PartDoc part = (PartDoc)doc;
                foreach (var t in new[] { swBodyType_e.swSolidBody, swBodyType_e.swSheetBody, swBodyType_e.swGraphicsBody })
                {
                    object[] all = (object[])part.GetBodies2((int)t, false);
                    object[] vis = (object[])part.GetBodies2((int)t, true);
                    Console.WriteLine("  " + t + ": " + (all == null ? 0 : all.Length) + " (visible " + (vis == null ? 0 : vis.Length) + ")");
                    if (all != null) foreach (Body2 b in all) Console.WriteLine("      " + b.Name + (b.Visible ? "" : " [hidden]"));
                }
            }
            string outFile = Opt("out", "");
            if (outFile == "") return 0;
            Directory.CreateDirectory(Path.GetDirectoryName(outFile));
            if (File.Exists(outFile)) File.Delete(outFile);
            int e = 0, w = 0;
            bool r = doc.Extension.SaveAs3(outFile, (int)swSaveAsVersion_e.swSaveAsCurrentVersion,
                (int)(swSaveAsOptions_e.swSaveAsOptions_Silent | swSaveAsOptions_e.swSaveAsOptions_Copy), null, null, ref e, ref w);
            bool ok = r && File.Exists(outFile) && new FileInfo(outFile).Length > 0;
            Console.WriteLine("SaveAs3 " + Path.GetFileName(outFile) + ": " + (ok ? "ok, " + new FileInfo(outFile).Length + " bytes" : "FAILED (err " + e + ", warn " + w + ")"));
            return ok ? 0 : 5;
        }

        // ------------------------------------------------------------ tess (surface-body fallback)
        // The glTF add-in skips sheet (surface) bodies. This walks components, tessellates every
        // visible solid + sheet body of each referenced part IN PART SPACE (Face2.GetTessTriangles)
        // and writes a binary file that merge-tess.mjs attaches to the matching glb nodes.
        //
        //   tess --src <file> --out <file.tess> [--only "Fuselage-1;Part1-*"] [--exclude <txt>]
        //
        // Format (little endian): "SWTESS1\0", int32 count, then per body:
        //   utf8 string component (int32 length + bytes), utf8 string body name,
        //   16 x float64 component transform (Transform2.ArrayData, identity for a part),
        //   float32 r,g,b (body/part colour or -1), int32 triangles, triangles*9 float32 positions (m),
        //   triangles*9 float32 normals.
        static void WriteStr(BinaryWriter bw, string s)
        {
            byte[] b = Encoding.UTF8.GetBytes(s ?? "");
            bw.Write(b.Length); bw.Write(b);
        }

        static float[] ColorOf(Body2 b, ModelDoc2 md)
        {
            try
            {
                double[] v = (double[])b.MaterialPropertyValues2;
                if (v != null && v.Length >= 3 && v[0] >= 0) return new[] { (float)v[0], (float)v[1], (float)v[2] };
            }
            catch { }
            try
            {
                double[] v = (double[])md.MaterialPropertyValues;
                if (v != null && v.Length >= 3 && v[0] >= 0) return new[] { (float)v[0], (float)v[1], (float)v[2] };
            }
            catch { }
            return new[] { -1f, -1f, -1f };
        }

        static int TessBodies(BinaryWriter bw, string comp, ModelDoc2 md, double[] xf)
        {
            if (md == null || md.GetType() != (int)swDocumentTypes_e.swDocPART) return 0;
            PartDoc part = (PartDoc)md;
            int n = 0;
            foreach (var t in new[] { swBodyType_e.swSolidBody, swBodyType_e.swSheetBody })
            {
                object[] bodies = (object[])part.GetBodies2((int)t, true);
                if (bodies == null) continue;
                foreach (Body2 b in bodies)
                {
                    var pos = new List<float>();
                    var nrm = new List<float>();
                    object[] faces = (object[])b.GetFaces();
                    if (faces == null) continue;
                    foreach (Face2 f in faces)
                    {
                        float[] tp = (float[])f.GetTessTriangles(true);
                        float[] tn = (float[])f.GetTessNorms();
                        if (tp == null || tp.Length == 0) continue;
                        pos.AddRange(tp);
                        if (tn != null && tn.Length == tp.Length) nrm.AddRange(tn);
                        else for (int i = 0; i < tp.Length; i++) nrm.Add(0f);
                    }
                    if (pos.Count == 0) continue;
                    WriteStr(bw, comp);
                    WriteStr(bw, b.Name);
                    for (int i = 0; i < 16; i++) bw.Write(xf != null && i < xf.Length ? xf[i] : (i == 0 || i == 4 || i == 8 || i == 12 ? 1.0 : 0.0));
                    foreach (float c in ColorOf(b, md)) bw.Write(c);
                    bw.Write(pos.Count / 9);
                    foreach (float v in pos) bw.Write(v);
                    foreach (float v in nrm) bw.Write(v);
                    Console.WriteLine("  " + comp + " / " + b.Name + " (" + t + "): " + (pos.Count / 9) + " triangles");
                    n++;
                }
            }
            return n;
        }

        static int Tess(ModelDoc2 doc)
        {
            string outFile = Req("out");
            Directory.CreateDirectory(Path.GetDirectoryName(outFile));
            var only = Opt("only", "").Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(g => new Regex("^" + Regex.Escape(g.Trim()).Replace("\\*", ".*").Replace("\\?", ".") + "$", RegexOptions.IgnoreCase)).ToList();
            var ex = LoadExclusions();
            int count = 0;
            using (var ms = new MemoryStream())
            using (var bw = new BinaryWriter(ms))
            {
                if (doc.GetType() == (int)swDocumentTypes_e.swDocASSEMBLY)
                {
                    object[] comps = (object[])((AssemblyDoc)doc).GetComponents(false);
                    foreach (Component2 c in comps.Cast<Component2>())
                    {
                        if (c.GetSuppression2() == 0 || (c.IsHidden(true) && Opt("hidden", "0") != "1")) continue;
                        string name = c.Name2 ?? "";
                        string leaf = name.Contains("/") ? name.Substring(name.LastIndexOf('/') + 1) : name;
                        if (only.Count > 0 && !only.Any(r => r.IsMatch(name) || r.IsMatch(leaf))) continue;
                        if (ex.Count > 0 && Matches(ex, c)) continue;
                        MathTransform mt = c.Transform2;
                        count += TessBodies(bw, leaf, (ModelDoc2)c.GetModelDoc2(), mt == null ? null : (double[])mt.ArrayData);
                    }
                }
                else count += TessBodies(bw, doc.GetTitle(), doc, null);
                bw.Flush();
                using (var fs = File.Create(outFile))
                using (var hw = new BinaryWriter(fs))
                {
                    hw.Write(Encoding.ASCII.GetBytes("SWTESS1\0"));
                    hw.Write(count);
                    ms.Position = 0;
                    ms.CopyTo(fs);
                }
            }
            Console.WriteLine("Wrote " + count + " bodies to " + outFile + " (" + new FileInfo(outFile).Length + " bytes)");
            return count > 0 ? 0 : 6;
        }

        // ------------------------------------------------------------ mates (read-only inspection)
        // Lists the mates of components whose name matches --comp (regex) in an assembly that is
        // already open, with each mate entity's parameters in assembly space (for a cylindrical
        // face: point x,y,z, axis i,j,k, radius). Changes nothing and never saves.
        static int Mates(string src, string compRx)
        {
            ModelDoc2 doc = FindOpen(src);
            if (doc == null) throw new Exception("Assembly is not open in SOLIDWORKS: " + src);
            if (doc.GetType() != (int)swDocumentTypes_e.swDocASSEMBLY) throw new Exception("Not an assembly");
            var rx = new Regex(compRx, RegexOptions.IgnoreCase);
            object[] comps = (object[])((AssemblyDoc)doc).GetComponents(true);
            foreach (Component2 c in comps.Cast<Component2>().OrderBy(c => c.Name2))
            {
                if (!rx.IsMatch(c.Name2 ?? "")) continue;
                Console.WriteLine(c.Name2);
                object[] mates = (object[])c.GetMates();
                if (mates == null) { Console.WriteLine("  (no mates)"); continue; }
                foreach (object o in mates)
                {
                    Mate2 m = o as Mate2;
                    if (m == null) continue;
                    var parts = new List<string>();
                    for (int i = 0; i < m.GetMateEntityCount(); i++)
                    {
                        MateEntity2 me = m.MateEntity(i);
                        Component2 rc = me.ReferenceComponent;
                        double[] p = me.EntityParams as double[];
                        parts.Add((rc == null ? "?" : rc.Name2) + " type " + me.ReferenceType2 + " [" +
                            (p == null ? "" : string.Join(",", p.Select(v => (v * 1000).ToString("0.###", CultureInfo.InvariantCulture)))) + "]");
                    }
                    Console.WriteLine("  mate type " + m.Type + " align " + m.Alignment + " :: " + string.Join("  <->  ", parts));
                }
            }
            return 0;
        }

        // ------------------------------------------------------------ glb
        static int Glb(ModelDoc2 doc)
        {
            string outFile = Req("out");
            Directory.CreateDirectory(Path.GetDirectoryName(outFile));
            ApplyExclusions(doc);
            ModelDocExtension ext = doc.Extension;
            int none = (int)swUserPreferenceOption_e.swDetailingNoOptionSpecified;

            string tess = Opt("tess", "keep");
            int q0 = ext.GetUserPreferenceInteger((int)swUserPreferenceIntegerValue_e.swImageQualityShaded, none);
            double d0 = ext.GetUserPreferenceDouble((int)swUserPreferenceDoubleValue_e.swImageQualityShadedDeviation, none);
            Console.WriteLine("Shaded quality was " + q0 + ", deviation " + d0.ToString("G6", CultureInfo.InvariantCulture));
            if (tess != "keep")
            {
                if (doc.GetType() == (int)swDocumentTypes_e.swDocASSEMBLY)
                    ext.SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swImageQualityApplyToAllReferencedPartDoc, none, true);
                if (tess == "coarse")
                    ext.SetUserPreferenceInteger((int)swUserPreferenceIntegerValue_e.swImageQualityShaded, none, (int)swImageQualityShaded_e.swShadedImageQualityCoarse);
                else
                {
                    double f = double.Parse(tess.TrimStart('x'), CultureInfo.InvariantCulture);
                    ext.SetUserPreferenceInteger((int)swUserPreferenceIntegerValue_e.swImageQualityShaded, none, (int)swImageQualityShaded_e.swShadedImageQualityCustom);
                    ext.SetUserPreferenceDouble((int)swUserPreferenceDoubleValue_e.swImageQualityShadedDeviation, none, d0 * f);
                }
                Console.WriteLine("Shaded quality now " + ext.GetUserPreferenceInteger((int)swUserPreferenceIntegerValue_e.swImageQualityShaded, none)
                    + ", deviation " + ext.GetUserPreferenceDouble((int)swUserPreferenceDoubleValue_e.swImageQualityShadedDeviation, none).ToString("G6", CultureInfo.InvariantCulture)
                    + " (in memory only)");
                doc.GraphicsRedraw2();
            }

            if (File.Exists(outFile)) File.Delete(outFile);
            int e = 0, w = 0;
            DateTime t0 = DateTime.Now;
            bool r = ext.SaveAs3(outFile, (int)swSaveAsVersion_e.swSaveAsCurrentVersion,
                (int)(swSaveAsOptions_e.swSaveAsOptions_Silent | swSaveAsOptions_e.swSaveAsOptions_Copy), null, null, ref e, ref w);
            bool ok = r && File.Exists(outFile) && new FileInfo(outFile).Length > 0;
            Console.WriteLine("SaveAs3 " + Path.GetExtension(outFile) + ": " + (ok ? "ok, " + new FileInfo(outFile).Length + " bytes" : "FAILED (err " + e + ", warn " + w + ")")
                + " in " + (DateTime.Now - t0).TotalSeconds.ToString("0") + " s");
            return ok ? 0 : 5;
        }
    }
}
