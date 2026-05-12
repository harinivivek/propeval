# Install Python

# Create a virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Use docker to install required libraries and start the application in local
make local-up
make migrate
make seed
