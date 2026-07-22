output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs ordered by availability zone."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private application subnet IDs ordered by availability zone."
  value       = aws_subnet.private[*].id
}

output "private_route_table_id" {
  description = "Private application route table used for database peering."
  value       = aws_route_table.private.id
}

output "nat_gateway_public_ip" {
  description = "Stable source IP for outbound private-subnet traffic."
  value       = aws_eip.nat.public_ip
}
