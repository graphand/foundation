# @graphand/server

To install dependencies:

```bash
bun install
```

## Environment Variables

The server requires the following environment variables to be set:

```
# MongoDB connection
DATABASE_MONGO_URI=mongodb://localhost:27017     # MongoDB URI (without credentials)
DATABASE_MONGO_USERNAME=                         # Optional: MongoDB username
DATABASE_MONGO_PASSWORD=                         # Optional: MongoDB password
```

You can set these in your environment or create a `.env` file in the server package directory.
