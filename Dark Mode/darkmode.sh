#!/bin/bash
# darkmode.sh
# Automatically sources coordinates using ipinfo.io and toggles macOS dark/light mode based on real sunrise and sunset times.

# Retrieve location automatically (IP-based geolocation)
LOCATION=$(curl -s ipinfo.io/json | jq -r '.loc')  # returns "LAT,LNG"
LAT=$(echo "$LOCATION" | cut -d',' -f1)
LNG=$(echo "$LOCATION" | cut -d',' -f2)

# URL for sunrise-sunset API; times are returned in UTC (ISO8601 format)
API_URL="https://api.sunrise-sunset.org/json?lat=${LAT}&lng=${LNG}&formatted=0"

# Fetch sunrise and sunset data from the API
response=$(curl -s "$API_URL")

# Extract sunrise and sunset times in UTC from the API response
sunrise_utc=$(echo "$response" | jq -r '.results.sunrise')
sunset_utc=$(echo "$response" | jq -r '.results.sunset')

# Convert the UTC times to local time (in HH:MM format)
sunrise_local=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$sunrise_utc" +"%H:%M")
sunset_local=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$sunset_utc" +"%H:%M")

# Get the current local time in HH:MM format
current_time=$(date +"%H:%M")

# Optional debug logging
# echo "Location: $LAT, $LNG"
# echo "Sunrise (local): $sunrise_local"
# echo "Sunset  (local): $sunset_local"
# echo "Current time   : $current_time"

# Compare current time with sunrise and sunset to toggle appearance mode:
if [[ "$current_time" > "$sunrise_local" && "$current_time" < "$sunset_local" ]]; then
    # Daytime: set to light mode
    osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to false'
else
    # Nighttime: set to dark mode
    osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'
fi