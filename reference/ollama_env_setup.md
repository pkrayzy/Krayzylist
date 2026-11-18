# Ollama Environment Setup Instructions (macOS/plist)

This guide sets key configuration parameters for Ollama on macOS using a LaunchAgent plist file. These parameters optimize model performance and resource usage.

## Environment Variables (Tuning Parameters)
- OLLAMA_CONTEXT_LENGTH=32768: Defines the maximum token context size the model can handle (e.g., 32k tokens). A larger context allows for better understanding of long documents.
- OLLAMA_FLASH_ATTENTION=1: Enables Flash Attention, a memory-efficient attention mechanism that significantly speeds up inference, especially for GPUs.
- OLLAMA_KV_CACHE_TYPE=q4_0: Specifies the quantization type (4-bit, 0-bits for block size). This reduces VRAM usage and improves inference speed with minimal quality loss.
- OLLAMA_MAX_LOADED_MODELS=1: Limits the number of models that Ollama can keep fully loaded in memory simultaneously, which can be useful for resource-constrained environments.

## Configuration Steps
1.  **Create plist:** A file named `com.ollama.env.plist` containing these settings is placed in `~/Library/LaunchAgents/`. This ensures the environment variables are set globally upon system load.
2.  **Load:** Use `launchctl load ~/Library/LaunchAgents/com.ollama.env.plist` to activate the environment variables for the current user session.
3.  **Reload/Unload:** Use `launchctl unload ~/Library/LaunchAgents/com.ollama.env.plist 2>/dev/null` to disable the configuration, and then `launchctl load ~/Library/LaunchAgents/com.ollama.env.plist` to ensure the latest settings are active.

**Plist Details:**
The configuration is defined in `~/Library/LaunchAgents/com.ollama.env.plist`:
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://apple.com">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ollama.env</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>launchctl setenv OLLAMA_CONTEXT_LENGTH 32768; launchctl setenv OLLAMA_FLASH_ATTENTION 1; launchctl setenv OLLAMA_KV_CACHE_TYPE q4_0; launchctl setenv OLLAMA_MAX_LOADED_MODELS 1</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>

