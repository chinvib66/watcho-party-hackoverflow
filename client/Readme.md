# Watcho Party: Web Fronted

> Dishathon 2020: Team hackoverflow

## Installation

Clone the repository to a folder using command prompt/bash shell

```
> git clone https://github.com/chinvib66/watcho-party-web-frontend.git
> cd watcho-party-web-frontend
```

### Install dependencies

```
> npm i
```

Start the app

```
> npm start
```

App runs on http://localhost:3000

### Using Docker

Build and tag the docker image

```
> docker build -t watcho-party-fr:dev .
```

Spin up the container once build is done

```
docker run -it --rm -v ${PWD}:/app -v /app/node_modules -p 3001:3000 --env SOCKET_ENDPOINT=http://url_to_socket_endpoint --env-file ./.env  watcho-party-fr:dev
```

App runs on http://localhost:3001

To stop the container, (container name can be found using `docker container ls`)

```
docker stop container_name
```

> ### Note: For the sync to work, sync-backend server should be live.

You can edit the sync-backend server endpoint in `.env` file

## Usage

[Youtube Link]()
