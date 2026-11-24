# Source of truth for published facts

Every number or claim on the site, and where it comes from. This file is not deployed, because it sits outside `src/` and `public/`.

## Profile
| Fact | Value on site | Source |
|---|---|---|
| Degree period | Sep 2021 – Feb 2026 | CV (`E:\profile\cv_alireza_alinejad.pdf`); transcript says requirements were completed 19 Feb 2026 |
| GPA | 3.67 / 4 · 17.40 / 20 | CV, transcript |
| Cohort rank | 17th of 78 | CV, Honors |
| National exam | top 0.3%, Jul 2021 | CV |
| TOEFL iBT | 97 (R24 L28 S24 W21) | TOEFL report, 8 Nov 2025 |
| SSR Lab researcher | Aug 2023 – Jan 2026, supervisor Prof. Pourtakdoust | CV |
| TA roles and dates | as listed | CV p.2 |
| Transcript link | `edu.sharif.edu/v/400106592/E6E5F219F654688B5043BA67B99E2E2F` | given by Alireza (Nov 2026) |
| Research roadmap | three columns | `interview_presentation_1.pdf`, slide 8 |

## Dragonfly FWMAV / patent
| Fact | Value | Source |
|---|---|---|
| Patent application number | 140450140003008393, filed 2025, pending | CV |
| Inventors | Alinejad, Alikhani, Pourtakdoust, Mousavi | CV |
| Thesis authors / supervisor | Alinejad, Alikhani / Pourtakdoust; defended 17 Sep 2025 | thesis front matter |
| Mass | 82.4 g (breakdown in thesis Table 5.1) | thesis Ch. 5, patent claim 16 |
| Measured frequency | 19.90 Hz mean, SD 0.20 Hz, within 0.5% of 20 Hz | thesis §4.4 (LDV) |
| Amplitude | 45° total (±22.5°) | patent claim 12, thesis Table 4.12 |
| Gear ratio | 18.94 (26→36, 10→36, 10→38, module 0.5) | thesis §4.4, patent claim 3 |
| Motor | T-Motor F15, 6000 KV | thesis, patent |
| Wing | 185 mm spar, ribs 55/66/43 mm, 20 µm PET, 5.9 g | thesis Ch. 5, patent claim 10 |
| Endurance on bench | > 5 min continuous | thesis Ch. 4 |
| Limits | no free flight; AoA slip > 18 Hz; gear wear > 30 min | thesis Ch. 4 and 6 |
| CAD iterations | FM1–FM13 ("more than a dozen") | `D:\Programming\SolidWorks\Dragonfly\` folders |
| M1 coil | 1,155 turns, 0.06–0.2 mN·m peak | thesis §4.1 |
| M2 coreless | 14:79 gear, about ±29°, stable to 10 Hz | thesis §4.2 text (Fig. 4.5 box disagrees, so it isn't used) |
| M3 dove | 28 g estimated vs 20 g target, CAD only | thesis §4.3 |

Not used because sources conflict: body length (12 cm in the thesis vs 9.5 cm in the patent) and measured range (19.5–20.0 vs 19.5–20.8 Hz).

## AeroNEX (AD2)
| Fact | Value | Source |
|---|---|---|
| Team (6) / supervisor | report title pages | all AD2 final reports |
| Period | Feb – Jun 2025 | report dates |
| Propulsion | 8 DEP motors (MAGiDRIVE-20 class, 16/20 kW) + 2 O-470 (225 hp) | Propulsion report, `DEP.docx` |
| DEP propeller | 0.9 m, 5-blade | Propulsion report |
| Wing | 16.98 m², b 13.03 m, AR 10, S1223 | Wing Layout Table 2.1 |
| Airfoil decision matrix | S1223 9.25 … NACA 4412 5.35 | Wing Layout / Flap Sizing |
| Drag | C<sub>D0</sub> 0.0221, k 0.03745, (L/D)<sub>max</sub> 16.86 | Drag Polar report |
| Stability | S<sub>h</sub> 30 ft², S<sub>v</sub> 31 ft², SM about 15%, C<sub>nβ</sub> 0.26, OEI δ<sub>r</sub> 9.36° | Stability report |
| Cruise altitude | 8,000 ft | Drag Polar / Propulsion |
| Battery | 361 kg Li-ion under the floor | Fuselage & Systems |
| Wing structure | 2 spars, 10 stringers, Al 2024-T3, ABAQUS; Fluent L/D ≈ 17 | Wing Layout |
| Alireza's sections | DEP, Stability & Control, Cockpit | Word metadata of the drafts |

Not used because sources conflict: MTOW (5,612 vs 5,117 lb), fuselage length (9.42 vs 9.64 m), occupant count.

## Manticores (AD1)
| Fact | Value | Source |
|---|---|---|
| Team / advisor | Alinejad, Fadaei, Dashtbani, Pourkhosro / Banazadeh | FinalReport cover, `Matching_Diagram.m` header |
| Brief | RAeS ILADC 2024/25; worded as "designed to", not submitted | report §Mission; `E:\SUT\BSc\Competition\RAes\` |
| TOW (composite) | 11,061 lb = 5,017 kg | report p.88, poster |
| Span / length / wing / AR | 17.75 m / 12.5 m / 30.6 m² / 10.3 | report p.88 |
| Cruise | 175 kt at 10,000 ft | report p.88 |
| Seats | 8 passengers + 2 crew | `Parameters.m` |
| Tail | cruciform; S<sub>h</sub> 65 ft², S<sub>v</sub> 44 ft² | `Empennage Design.docx` (Alireza) |
| Sizing weight (Al) | 11,490 lb, reproduced by re-running the MATLAB code | `Main\main.m` |

Not used: matching-diagram S and P (they conflict with the adopted wing), and payload–range points C and D (a bug in the script).

## PRC Data Challenge 2025
Target `fuel_kg` per interval; pipeline of about 2,600 lines in `scripts/`. No model, score or rank exists in `E:\profile\PRC-Data-Chalange-main`, so none is claimed.

## MCST
Paper: Shen, Yuan, Yan, Ma, IEEE TAES 61(2):3205–3226, 2025, DOI 10.1109/TAES.2024.3484393. Reproduction claims follow the CV only ("Reproduced adaptive tracking model; incorporated Bi-LSTM and maneuver compensation unit").

## SITL simulator
Stated by Alireza (Nov 2026); no files were found on disk. The text is limited to their description.
