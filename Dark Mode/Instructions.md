1. Create the Shell Script
Save the following script (for example, as /usr/local/bin/darkmode.sh; make sure you update the absolute path as needed):
sh
#!/bin/bash
# /usr/local/bin/darkmode.sh
# Automatically source coordinates using ipinfo.io and toggle macOS dark/light mode based on real sunrise and sunset times.

# Retrieve location automatically (IP-based geolocation via ipinfo.io)
LOCATION=$(curl -s ipinfo.io/json | jq -r '.loc')  # returns "LAT,LNG"
LAT=$(echo "$LOCATION" | cut -d',' -f1)
LNG=$(echo "$LOCATION" | cut -d',' -f2)

# The sunrise-sunset API returns times in UTC (ISO8601 format)
API_URL="https://api.sunrise-sunset.org/json?lat=${LAT}&lng=${LNG}&formatted=0"

# Fetch sunrise and sunset data from the API
response=$(curl -s "$API_URL")

# Extract sunrise and sunset times in UTC from the API response
sunrise_utc=$(echo "$response" | jq -r '.results.sunrise')
sunset_utc=$(echo "$response" | jq -r '.results.sunset')

# Convert the UTC times to local time (in HH:MM format using macOS date command)
sunrise_local=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$sunrise_utc" +"%H:%M")
sunset_local=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$sunset_utc" +"%H:%M")

# Get the current local time in HH:MM format
current_time=$(date +"%H:%M")

# Optional logging for debugging; uncomment to enable:
# echo "Location: $LAT, $LNG"
# echo "Sunrise (local): $sunrise_local"
# echo "Sunset  (local): $sunset_local"
# echo "Current time   : $current_time"

# Compare current time with sunrise and sunset:
# If current time is between sunrise and sunset, set Light Mode; otherwise, set Dark Mode.
if [[ "$current_time" > "$sunrise_local" && "$current_time" < "$sunset_local" ]]; then
    # Daytime: set to light mode
    osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to false'
else
    # Nighttime: set to dark mode
    osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'
fi
Make the script executable:
sh
chmod +x /usr/local/bin/darkmode.sh
Note: This script requires jq. You can install it via Homebrew:
sh
brew install jq
2. Create a launchd Agent
Create a property list (plist) file for your launchd agent. Save this file as ~/Library/LaunchAgents/com.user.darkmode.plist (change com.user.darkmode to a label of your choice):
xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <!-- A unique identifier for this job -->
    <key>Label</key>
    <string>com.user.darkmode</string>
    
    <!-- Run the script every 60 seconds -->
    <key>StartInterval</key>
    <integer>60</integer>
    
    <!-- Specify the full path to your script -->
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/darkmode.sh</string>
    </array>
    
    <!-- Optional: Standard output and error paths for logging -->
    <key>StandardOutPath</key>
    <string>/tmp/darkmode.out</string>
    <key>StandardErrorPath</key>
    <string>/tmp/darkmode.err</string>
    
    <!-- Run the job immediately on load -->
    <key>RunAtLoad</key>
    <true/>
  </dict>
</plist>
Explanation of the keys:
Label: A unique identifier for the agent.
StartInterval: The interval (in seconds) at which the script runs—in this example, every minute.
ProgramArguments: An array containing the command (and any arguments) to run.
StandardOutPath/StandardErrorPath: File paths for logging output, which can help with troubleshooting.
RunAtLoad: Ensures the script runs immediately when the agent is loaded.
3. Load the launchd Agent
To load the agent, open Terminal and run:
sh
launchctl load ~/Library/LaunchAgents/com.user.darkmode.plist
You can check that it’s loaded with:
sh
launchctl list | grep com.user.darkmode
This will now run your /usr/local/bin/darkmode.sh every 60 seconds, ensuring that your Mac automatically switches to dark mode at sunset and light mode at sunrise.
Additional Considerations
Adjusting the Interval: If you prefer a different check frequency, you can modify the <integer>60</integer> value in the plist.
Time Zone Handling: The script converts the UTC sunrise and sunset times to your local time zone using the macOS date utility.
Error Logging: Check /tmp/darkmode.err if you run into issues. Adding extra logging inside the script (e.g. using echo statements) can help with debugging.