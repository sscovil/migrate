#!/bin/sh

# build node docker image to ensure any changes are captured
docker-compose build

# bring up the database container first
docker-compose up -d pg

# bring up the node container to run tests and capture exit code as $?
(docker-compose up --abort-on-container-exit --exit-code-from node)

# bring down database and node containers
docker-compose down

# exit with exit code captured from test run
exit $?
