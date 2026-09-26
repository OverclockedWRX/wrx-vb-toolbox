# WRX Tool Box!

Independent tools for **2022–2026 Subaru WRX (VB)** owners. Open the HTML file in your browser — no install, no account, and your files never leave your computer.

**Not affiliated with Subaru of America, Subaru Corporation, or COBB Tuning.** Subaru, WRX, Accessport, and COBB are trademarks of their respective owners.



**The COBB AP Log review is done by an algorithm. It DOES NOT have final say over your logs. Sometimes there is legitimate false knock.
It tries it's best to detect these scenarios but at the end of the day, it's not an AI chatbot, nor an actual human. 
The Log reviews are meant to be a quick check on things, and that is it. 
Obvious problems should be shown to the user, however, some things can get missed. Always have your tuner review your logs.**




## What’s inside

### Log review
- Drop in one or more **COBB Accessport CSV** logs
- Get a clear **S / A / B / F** grade with notes on AFR, boost, knock, and other red flags
- See charts for pulls, fueling, and estimated power
- Load **sample logs** anytime to try the review, including fictional 2nd and 3rd gear wide-open pulls
- Multi-file sessions open in tabs so you can compare pulls side by side

### VIN decoder
- Paste a 17-character VIN for year, trim, plant, and other details
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

1. Open `wrxtoolbox0.11.0.html` (from the release zip)
2. Read the short disclaimer and continue
3. Optionally set the car preset above the tabs
4. Use **Log review**, **Wheel / tire**, **VIN decoder**, or **OBD2 code lookup**

## Host it on your network

The release folder includes a `Dockerfile`. It only serves the HTML file. Logs still stay in each browser.

```bash
docker build -t wrxtoolbox:0.11.0 .
docker run -d --name wrxtoolbox -p 8080:80 wrxtoolbox:0.11.0
```

Open http://127.0.0.1:8080 on that computer, or http://&lt;that-computer-ip&gt;:8080 from another device on the same network. Stop it with `docker rm -f wrxtoolbox`.

Created by Scott Myers · MIT License
