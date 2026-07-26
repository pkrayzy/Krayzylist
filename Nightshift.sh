#!/bin/bash

# 1. Get Sunset and Sunrise times
# Since we aren't using a web API, we use a local calculation 
# or assume the system has them cached in the brightness diag
# For a reliable shell script, we calculate the current day's offset
# (This example uses a simplified calculation; for precision, 
#  the 'date' command is used to format the time)

# We use the current date to determine the sunset (approximate for your region)
# For 100% precision without a web API, macOS doesn't provide a local 
# "get_sunset" CLI tool other than the diagnostic one.
# We will extract the internal state from corebrightnessdiag to find the "current" sunset
# The output format is: sunset = "YYYY-MM-DD HH:MM:SS +0000"
RAW_SUNSET=$(/usr/libexec/corebrightnessdiag nightshift-internal | grep "sunset =" | sed 's/.*= "\(.*\)".*/\1/')
RAW_SUNRISE=$(/usr/libexec/corebrightnessdiag nightshift-internal | grep "sunrise =" | sed 's/.*= "\(.*\)".*/\1/')

# Convert UTC timestamps from corebrightnessdiag to local time
# We use -u to tell date the input is UTC, and output it as local time
CURRENT_SUNSET=$(date -j -f "%Y-%m-%d %H:%M:%S %z" "$RAW_SUNSET" "+%H:%M:%S")
CURRENT_SUNRISE=$(date -j -f "%Y-%m-%d %H:%M:%S %z" "$RAW_SUNRISE" "+%H:%M:%S")

# 2. Calculate 30 minutes prior to sunset
# Convert current sunset (now local) to seconds, subtract 1800, convert back to HH:mm
SUNSET_SEC=$(date -j -f "%H:%M:%S" "$CURRENT_SUNSET" "+%s")
START_SEC=$((SUNSET_SEC - 1800))
START_TIME=$(date -r $START_SEC +"%H:%M")

# 3. Apply the settings via UI Automation
# Because Night Shift settings are protected, we use osascript to drive the System Settings UI.
# This enables the native "Sunset to Sunrise" schedule.
#nightlight schedule $START_TIME $CURRENT_SUNRISE
~/.cargo/bin/nightlight schedule $START_TIME $CURRENT_SUNRISE