@echo off
rem Builds tools\cad\out\bin\SwExport.exe against the SOLIDWORKS 2025 interop assemblies.
setlocal
set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set SWAPI=D:\Program Files\SOLIDWORKS Corp\SOLIDWORKS\api\redist
set OUT=%~dp0out\bin
if not exist "%OUT%" mkdir "%OUT%"
copy /y "%SWAPI%\SolidWorks.Interop.sldworks.dll" "%OUT%\" >nul
copy /y "%SWAPI%\SolidWorks.Interop.swconst.dll" "%OUT%\" >nul
"%CSC%" /nologo /langversion:5 /platform:x64 /target:exe /optimize+ ^
  /out:"%OUT%\SwExport.exe" ^
  /r:"%OUT%\SolidWorks.Interop.sldworks.dll" ^
  /r:"%OUT%\SolidWorks.Interop.swconst.dll" ^
  "%~dp0SwExport.cs"
exit /b %ERRORLEVEL%
