output "name" {
  description = "Created AWS Budget name."
  value       = aws_budgets_budget.monthly.name
}
