#!/bin/bash
# darkmode.sh
# Automatically sources coordinates using ipinfo.io and toggles macOS dark/light mode based on real sunrise and sunset times.

# Extract sunrise and sunset times in UTC from the API response
sunrise_local=$(/usr/libexec/corebrightnessdiag nightshift-internal | grep -E "sunrise" | awk '{print $4}')
sunset_local=$(/usr/libexec/corebrightnessdiag nightshift-internal | grep -E "sunset" | awk '{print $4}')

# Convert the UTC times to local time (in HH:MM format)
# sunrise_local=$(date -jf "%Y-%M-%D %H:%M:%S" "$sunrise_utc" +"%H:%M:%S")
# sunset_local=$(date -jf "%H:%M:%S" "$sunset_utc" +"%H:%M:%S")

# Get the current local time in HH:MM format
current_time=$(date -u +"%H:%M:%S")

# Optional debug logging
# echo "Location: $LAT, $LNG"
# echo "Sunrise (local): $sunrise_local"
# echo "Sunset  (local): $sunset_local"
# echo "Current time   : $current_time"

# Compare current time with sunrise and sunset to toggle appearance mode:
if [[ "$current_time" < "$sunrise_local" && "$current_time" > "$sunset_local" ]]; then
    # Nighttime: set to dark mode
    osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'
else
    # Daytime: set to light mode
    osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to false'
fi