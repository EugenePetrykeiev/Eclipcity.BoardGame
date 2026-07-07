output "instance_id" {
  description = "EC2 instance ID."
  value       = aws_instance.postgres.id
}

output "public_ip" {
  description = "Public IPv4 address of the EC2 instance."
  value       = aws_instance.postgres.public_ip
}

output "ssh_command" {
  description = "Command to connect to the instance."
  value       = "ssh -i ${var.private_key_path} ec2-user@${aws_instance.postgres.public_ip}"
}

output "postgres_connect_example" {
  description = "Example psql command after you create a database user."
  value       = "psql 'host=${aws_instance.postgres.public_ip} port=5432 dbname=appdb user=appuser sslmode=prefer'"
}
