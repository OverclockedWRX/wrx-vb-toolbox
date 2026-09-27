# WRX Tool Box!

Independent tools for **2022–2026 Subaru WRX (VB)** owners. Open the HTML file in your browser — no install, no account, and your files never leave your computer.

**Not affiliated with Subaru of America, Subaru Corporation, or COBB Tuning.** Subaru, WRX, Accessport, and COBB are trademarks of their respective owners.



**The log review is a fixed checklist. It does not have the last word on a log. Your tuner does.**

It is not an AI chatbot and it is not a human. It is a spot check for obvious problems. Some things can still be missed. Always have your tuner review the logs.

**Knock.** Feedback knock while under load (at least 80% pedal and at least 5 psi) is an **F**, except a short blip no worse than **−1.41°** that lasts no more than **0.30 seconds** when DAM stays at **1.00** and fine knock learn stays flatter than **−0.70°**. That exception is noted as possible sensor noise. It is not a clean pass. Off-boost feedback knock is a note. Dropped DAM, or fine knock learn at −0.70° or below, is still called out.




## What’s inside

### Log review
- Drop in one or more **COBB Accessport CSV** logs
- Get a clear **S / A / B / F** grade with notes on AFR, boost, knock, and other red flags
- See charts for pulls, fueling, and estimated power
- Load **sample logs** anytime to try the review, including fictional 2nd and 3rd gear wide-open pulls
- Multi-file sessions open in tabs so you can compare pulls side by side

### VIN decoder
- Paste a 17-character VIN for year, trim, plant, and other details
- Recalls and service bulletins from NHTSA are listed above the decoder. Recalls are red. Service bulletins are yellow and link to the NHTSA document
- The sales country is not in the VIN. The decoder explains the destination code on the vehicle ID plate

### OBD2 code lookup
- Type a scanner code and read a short meaning
- Subaru-named codes are marked separately from generic SAE wording

### Wheel / tire
- Compare a proposed wheel and tire setup to **stock**
- Drag a **3D six-spoke** preview to turn the wheels and see diameter, width, and offset
- See diameter change, sidewall, poke, and speedometer error
- Fitment guidance for stock height and for a lowered car, with separate front and rear drop. The numbers are estimates from owner reports such as r/wrx_vb

### Shared helpers
- **Car preset** — sits above the tabs. Pick market, year, and trim to load stock weight and tire size for both tools. Filling it from a VIN is planned for when the sales country can be determined
- **Dark mode** — switch themes; your choice is remembered in this browser

## How to use it

1. Open `wrxtoolbox0.13.0.html` (from the release zip)
2. Read the short disclaimer and continue
3. Optionally set the car preset above the tabs
4. Use **Log review**, **Wheel / tire**, **VIN decoder**, or **OBD2 code lookup**

## Host it on your network

The release folder includes a `Dockerfile`. It only serves the HTML file. Logs still stay in each browser.

```bash
docker build -t wrxtoolbox:0.13.0 .
docker run -d --name wrxtoolbox -p 8080:80 wrxtoolbox:0.13.0
```

Open http://127.0.0.1:8080 on that computer, or http://&lt;that-computer-ip&gt;:8080 from another device on the same network. Stop it with `docker rm -f wrxtoolbox`.

Created by Scott Myers · MIT License
