variable "cloudflare_account_id" {
  description = "Your Cloudflare Account ID"
  type        = string
  default     = "28a8fb99e937b1afbe7134d719e8253d"
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Your Cloudflare API token for provisioning resources"
  type        = string
  default     = "gd1_2IhOpoigbH2fVr8l6lmI4qvd4yIpAoxM0o4d"
  sensitive   = true
}
