# VB WRX Accessport log review

A browser review for Cobb Accessport CSV logs from the WRX VB, model years 2022 through 2026. Load one or more files, then start the review. Your logs stay in the browser.

**Not affiliated with Subaru of America, Subaru Corporation, or COBB Tuning.** Subaru, WRX, Accessport, and COBB are trademarks of their respective owners. This project is independent and unofficial.

Licensed under the [MIT License](LICENSE).

## Download for any computer (no install)

Build a zip that anyone can open without Node, npm, or an internet connection:

```bash
npm install
npm run pack
```

That writes `release/WRX-Tune-Check.zip`. Inside it is one HTML file. On Windows, macOS, or Linux:

1. Unzip the download
2. Double-click `WRX-Tune-Check.html`
3. Load Accessport CSV files (or use the sample logs) and start the review

Everything the page needs is inside that HTML file, including the fictional sample logs. There is no server to start.

## Develop it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

The page has two large tabs: **Log review** (Accessport CSV grading) and **Wheel / tire** (size and offset calculator). VIN decode and car preset sit under the tabs and feed both tools.

**Dark mode** in the header switches the page. The choice is saved in this browser. Until you choose, the page follows the system theme.

Choose CSV files, or use **Load sample logs**. That button picks a fictional set at random: an S, A, or B story, a 50 psi F, or a knock F. Set fuel octane to “From the tune name” when the map name includes an octane. Under **VIN decoder**, paste a 17-character VIN. When a VIN is entered the details table expands with as many fields as NHTSA vPIC returns (make, model, year, trim, engine, plant, safety equipment, and more). Offline, a local structural decode still reports WMI, year, plant, chassis generation, and check-digit status. The section stays collapsed until a VIN is entered.

Under **Car preset for road-load power**, pick market, model year, and trim to load curb weight (plus a 170 lb driver), Cd 0.32, frontal area, and drivetrain loss for US, Canada, Australia, New Zealand, or Japan WRX VB cars. You can still edit those fields by hand. Then click **Start review**.

Under **Wheel / tire offset calculator**, compare a proposed wheel and tire to stock. Stock size is taken from the VIN trim or the car preset when available, or you can pick Base 17″ / Premium 18″ / TR·tS 19″ and type every number by hand. The comparison shows diameter change, sidewall, poke vs stock, speedo error, and stock-height fitment notes (max about 18×9.5 ET35–38 with up to ~255–265 section). **Sizes that fit are for stock ride height only; lowered cars are not considered.**

The footer shows **Created by Scott Myers**, the app version (matching `package.json`), the MIT license, and the Subaru/COBB non-affiliation notice.

The Accessport header is read for the car and the reflash. Each CSV gets its own review. When you load more than one file, the results open in tabs so you can click between them. The grade uses safe wide-open AFR limits for 87, 89, 91, 92, or 93 octane, scaled to the boost target in the tune name. If the tune name has no octane, the review waits until you pick one. If a required channel is missing, the review lists every channel it needs and every channel that is missing, and it explains that there is not enough data to write a review.

The dyno smoothing slider averages the chart lines. The shaded AFR band is the preferred window for the octane and boost target, not a fixed 10.6–11.6 band.

## What the review requires

Time, RPM, Accel Position, AF Sens 1 Ratio, Comm Fuel Final, Boost, Target Boost Final Rel, DAM, Feedback Knock, Fine Knock Learn, Ignition Timing, AF Learning 1, AF Learning 3, AF Correction 1, Calculated Load, Gear Position, Fuel Pressure, Coolant Temp, Intake Temp or Intake Temp Manifold, Vehicle Speed, and the AP Info header.

The header has to identify a WRX from 2022 through 2026. Other Subarus are refused.

## Grade

S is the best (blue), A is great (green), B means the tune should be adjusted (yellow), and F is for outstanding issues like lean/rich AFR, knock, or DAM (red). The review lists what it noticed and what should change.

## What the power numbers are

Crank horsepower comes from airflow. `Calculated Load (g/rev) × rpm / 60` is grams of air per second. That air is treated as burning gasoline at 14.7:1, and the thermal efficiency you set turns the fuel energy into horsepower. Torque is `hp × 5252 / rpm`. Wheel figures subtract the drivetrain loss.

If you enter weight, a second estimate uses acceleration, aerodynamic drag, and rolling resistance. Both are estimates, not a chassis-dyno result.

## Sample logs

`logs/sample-*.csv` are fictional 2024 WRX files. The header on each one says SAMPLE DATA. S, A, B, and C packs are ordinary made-up pulls. `sample-50psi.csv` claims a normal boost target and then logs 50 psi. `sample-knock.csv` logs an impossible DAM and a long feedback-knock event. A knock-heavy sample set prints **HEADGASKETS HAVE LEFT THE CHAT!** on the rating. The packaged HTML embeds the same sample files so offline use still works.
