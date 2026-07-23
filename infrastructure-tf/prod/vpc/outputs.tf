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
  description = "Private route table retained for future workloads; it has no default egress when NAT is disabled."
  value       = aws_route_table.private.id
}

output "public_route_table_id" {
  description = "Public route table used by the cost-optimized backend and frontend nodes."
  value       = aws_route_table.public.id
}

output "nat_gateway_public_ip" {
  description = "NAT Gateway public IP when NAT is enabled; null in the default cost-optimized production setup."
  value       = try(aws_eip.nat[0].public_ip, null)
}
