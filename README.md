# PBuddY - Personal AI Buddy

PBuddY is a Node.js application that acts as a personal AI assistant, leveraging a locally running Ollama instance for AI chat functionalities. It provides a REST API to manage users, chat sessions, and interactions with the AI.

## Features

*   User management (creation)
*   Chat session creation and retrieval
*   Message handling within chat sessions
*   Integration with a local Ollama service for AI responses
*   Token counting for chat context management
*   Database schema management using Sequelize migrations
*   Sample data seeding

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js:** Version 18.x or higher recommended.
*   **npm:** (Usually comes with Node.js).
*   **MySQL:** A running MySQL server instance.
*   **Ollama:**
    *   Ollama installed and running locally. Download from [ollama.com](https://ollama.com/).
    *   At least one model pulled, e.g., `llama2` or `mistral`. You can pull a model by running:
        ```bash
        ollama pull llama2
        ```

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/IamFishR/pbuddy.git
    cd pbuddy
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Environment Setup

1.  **Create a `.env` file** in the root of the project by copying the example:
    ```bash
    cp .env.example .env
    ```
    *(Note: I will create `.env.example` in the next step, as it wasn't explicitly part of the plan but is good practice for READMEs like this.)*

2.  **Configure your `.env` file** with your local settings:
    ```
    DB_HOST=localhost
    DB_USER=your_mysql_user
    DB_PASSWORD=your_mysql_password
    DB_NAME=pbuddy_db
    PORT=3000

    # Ollama API endpoint (if different from default http://localhost:11434)
    # OLLAMA_HOST=http://localhost:11434
    ```
    Replace `your_mysql_user` and `your_mysql_password` with your MySQL credentials. The `DB_NAME` will be created if it doesn't exist when migrations are run.

## Database Setup

1.  **Ensure your MySQL server is running.**

2.  **Create the database (if it doesn't exist):**
    You can manually create the database specified in your `.env` file (e.g., `pbuddy_db`) using a MySQL client:
    ```sql
    CREATE DATABASE pbuddy_db;
    ```
    Alternatively, the first migration run might create it if your MySQL user has sufficient privileges, but manual creation is safer.

3.  **Run database migrations:**
    This command will create all the necessary tables in your database according to the schema.
    ```bash
    npm run db:migrate
    ```

4.  **Run database seeders (optional but recommended for initial testing):**
    This command will populate the database with some sample data (e.g., test users).
    ```bash
    npm run db:seed:all
    ```

## Running the Application

1.  **Start the application:**
    ```bash
    npm start
    ```
    The server will start, typically on port 3000 (or the port specified in your `.env` file). You should see a message like `Server is listening on port 3000`.

2.  **Ensure Ollama is running:**
    Make sure your local Ollama service is active and the model you intend to use (default `llama2` or specified in API calls) is available.

## Basic API Endpoints

Here are some of the main API endpoints to get you started:

*   **Create a User:**
    *   `POST /api/users`
    *   Body: `{ "username": "your_username" }`

*   **Create a Chat:**
    *   `POST /api/chats`
    *   Body: `{ "userId": 1 }` (replace `1` with an actual user ID)

*   **Send a Message to a Chat:**
    *   `POST /api/chats/:chatId/messages` (replace `:chatId` with an actual chat ID)
    *   Body: `{ "userId": 1, "content": "Hello, AI!", "model": "llama2" }` (model is optional, defaults to llama2)

*   **Get Messages for a Chat:**
    *   `GET /api/chats/:chatId/messages`

*   **Get User Details:**
    *   `GET /api/users/:userId`

*   **Get Chat Details:**
    *   `GET /api/chats/:chatId`

*   **Get All Chats for a User:**
    *   `GET /api/chats/user/:userId`

## Development

*   To run the server with `nodemon` for automatic restarts on file changes (if you have it installed globally or add it to devDependencies):
    ```bash
    npm run dev
    ```

*   **Undoing migrations/seeds:**
    *   `npm run db:migrate:undo` (undo the last migration)
    *   `npm run db:migrate:undo:all` (undo all migrations)
    *   `npm run db:seed:undo:all` (undo all seeds)

## Ollama Service Notes

*   The application expects your Ollama service to be running at `http://localhost:11434` by default. If it's different, set the `OLLAMA_HOST` variable in your `.env` file.
*   Ensure the AI models you wish to use (e.g., `llama2`, `mistral`) are pulled into your Ollama instance. You can list your local models with `ollama list`.
```
