# Library Management System (Frontend + Node.js Backend + MySQL)

This project contains the supplied Express/MySQL backend, SQL schema, and a completed vanilla HTML/CSS/JavaScript frontend.

## Requirements
- Node.js 18 or later
- MySQL Server and MySQL Workbench (or another MySQL client)
- VS Code with the Live Server extension (recommended)

## 1. Import the database
1. Open MySQL Workbench and connect to your local MySQL server.
2. Open `database/schema.sql`.
3. Execute the complete script. It creates `library_management` and sample categories, books, members and transactions.
4. Note: the SQL file intentionally does not insert a fake password hash. Create your own working admin account in Step 3.

If you already have a database with the same tables and columns, back it up first and do not re-import the sample schema over your existing data.

## 2. Configure the backend
1. Open the `backend` folder in a terminal.
2. Copy `.env.example` to a new file named `.env`.
3. Edit `.env` and enter your MySQL username/password. Set a long random `JWT_SECRET`.
4. Install dependencies:

```bash
npm install
```

Example `.env` values for a local MySQL installation:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=library_management
PORT=5000
JWT_SECRET=replace_this_with_a_long_random_secret
FRONTEND_URL=http://localhost:5500
FINE_RATE_PER_DAY=1.00
```

Do not upload or share your `.env` file.

## 3. Create the administrator login
From the `backend` folder run:

```bash
node scripts/createAdmin.js admin@library.com StrongPass123
```

Use the email and password you supplied on the login screen. Change the example password to your own strong password.

## 4. Start the backend
From the `backend` folder:

```bash
npm start
```

The API should be available at `http://localhost:5000/api`. Check `http://localhost:5000/api/health` in a browser; it should return a JSON success message.

## 5. Start the frontend
1. In VS Code, open the `frontend` folder.
2. Install/use the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.
4. The site commonly opens at `http://127.0.0.1:5500` or `http://localhost:5500`. The backend CORS configuration permits both.

The frontend API URL is at the top of `frontend/js/api.js`:

```js
const API_BASE = 'http://localhost:5000/api';
```

Change it only if your backend runs at a different host or port.

## Features
- Admin login and JWT-protected API calls
- Dashboard statistics and recent activity
- Books: list/search/add/edit/delete, available-copy display
- Members: list/search/add/edit/delete
- Categories: add/edit/delete
- Transactions: issue and return books, due dates and fines
- Reports: overdue books, most borrowed, available stock and member statistics
- CSV export for reports
- Responsive layout for desktop and mobile
- Backend transaction logic refuses to issue a book when `available_copies` is zero; the UI also hides the issue action when there are no available copies.

## Important notes
- Book issue/return changes are saved in MySQL through the API. Refreshing the browser does not reset stock.
- The backend uses a fine rate of ₹1 per overdue day by default; change `FINE_RATE_PER_DAY` in `.env` if required.
- If the frontend shows “Cannot connect to backend”, make sure the backend terminal is still running and check the API health URL.
- If you see a CORS error, confirm the Live Server URL is included in `FRONTEND_URL` in `.env`, or remove that variable to use the built-in local development origins.
- This is a student project starter. Before production deployment, add stricter authorization/role checks, HTTPS, rate limiting, secure deployment secrets, and backups.
# MARS-LIBRARY
# MARS-LIBRARY
# MARS-LIBRARY
# MARS-LIBRARY
