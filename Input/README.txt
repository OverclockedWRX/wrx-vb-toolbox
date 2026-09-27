WRX Tool Box! v0.14.0
========================================

This folder needs no install. No Node and no npm. Logs stay in the browser. The VIN tab contacts NHTSA when you use it.

1. Double-click wrxtoolbox0.14.0.html
2. It opens in your default browser
3. Use the Log review or Wheel / tire tabs
4. Load Accessport CSV files, or click "Load sample logs"
5. Optionally pick a car preset (market / year / trim)
6. Click "Start review" — each CSV opens in its own tab when you load more than one

Your logs stay in the browser. The VIN tab contacts NHTSA when you use it.

Works on Windows, macOS, and Linux. If the page is blank, try Chrome,
Edge, or Firefox. Keep this HTML as one file; leave the .html extension.

Host on your own network (Docker)
----------------------------------
Docker only serves this HTML file. Logs still stay in each browser.

1. Install Docker
2. In this folder:
     docker build -t wrxtoolbox:0.14.0 .
     docker run -d --name wrxtoolbox -p 8080:80 wrxtoolbox:0.14.0
3. On this computer, open http://127.0.0.1:8080
4. On another computer on the same network, open http://<this-computer-ip>:8080

Stop it with: docker rm -f wrxtoolbox

These sample logs are fictional. They are not from a real car.

Not affiliated with Subaru of America, Subaru Corporation, or COBB Tuning.
Subaru, WRX, Accessport, and COBB are trademarks of their respective owners.
This software is independent and unofficial. Licensed under the MIT License.
