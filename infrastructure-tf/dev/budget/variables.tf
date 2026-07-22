variable "name_prefix" {
  description = "Prefix used for the budget name."
  type        = string
}

variable "monthly_limit_usd" {
  description = "Monthly cost threshold in USD."
  type        = number
}

variable "alert_email" {
  description = "Email address receiving budget notifications."
  type        = string
  nullable    = false
  sensitive   = true
}

variable "tags" {
  description = "Common AWS tags."
  type        = map(string)
}
