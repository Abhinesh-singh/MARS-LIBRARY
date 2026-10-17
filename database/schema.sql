-- Library Management System Database Schema
-- Create database
CREATE DATABASE IF NOT EXISTS library_management;
USE library_management;

-- Users table for admin authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'librarian') DEFAULT 'librarian',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(20) NOT NULL UNIQUE,
    category_id INT NOT NULL,
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    published_year YEAR,
    publisher VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_title (title),
    INDEX idx_author (author),
    INDEX idx_isbn (isbn),
    INDEX idx_category (category_id)
);

-- Members table
CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_member_id (member_id),
    INDEX idx_email (email),
    INDEX idx_name (full_name)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    member_id INT NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE NULL,
    status ENUM('issued', 'returned', 'overdue') DEFAULT 'issued',
    fine_amount DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_book (book_id),
    INDEX idx_member (member_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
);

-- Create the first admin account after importing this schema:
-- From the backend folder run: node scripts/createAdmin.js admin@library.com admin123

-- Insert sample categories
INSERT IGNORE INTO categories (name, description) VALUES 
('Fiction', 'Fictional literature including novels, short stories'),
('Non-Fiction', 'Factual and informative books'),
('Science', 'Scientific books and research'),
('Technology', 'Computer science, programming, IT'),
('History', 'Historical books and biographies'),
('Mathematics', 'Mathematical textbooks and references'),
('Literature', 'Classic and contemporary literature'),
('Arts', 'Art, music, and creative books');

-- Insert sample books
INSERT IGNORE INTO books (title, author, isbn, category_id, total_copies, available_copies, published_year, publisher) VALUES
('The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 1, 5, 5, 1925, 'Scribner'),
('To Kill a Mockingbird', 'Harper Lee', '9780061120084', 1, 3, 3, 1960, 'J.B. Lippincott & Co.'),
('1984', 'George Orwell', '9780451524935', 1, 4, 4, 1949, 'Secker & Warburg'),
('A Brief History of Time', 'Stephen Hawking', '9780553380163', 3, 2, 2, 1988, 'Bantam Books'),
('Clean Code', 'Robert C. Martin', '9780132350884', 4, 3, 3, 2008, 'Prentice Hall'),
('The Pragmatic Programmer', 'Andrew Hunt', '9780201616224', 4, 2, 2, 1999, 'Addison-Wesley'),
('Sapiens', 'Yuval Noah Harari', '9780062316097', 5, 3, 3, 2011, 'Harvill Secker'),
('Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', 6, 2, 2, 2009, 'MIT Press'),
('The Art of War', 'Sun Tzu', '9781599869773', 5, 4, 4, NULL, 'Multiple'),
('Atomic Habits', 'James Clear', '9780735211292', 2, 5, 5, 2018, 'Avery');

-- Insert sample members
INSERT IGNORE INTO members (member_id, full_name, email, phone, address, status) VALUES
('LIB001', 'John Smith', 'john.smith@email.com', '555-0101', '123 Main St, City', 'active'),
('LIB002', 'Jane Doe', 'jane.doe@email.com', '555-0102', '456 Oak Ave, City', 'active'),
('LIB003', 'Robert Johnson', 'robert.j@email.com', '555-0103', '789 Pine Rd, City', 'active'),
('LIB004', 'Emily Davis', 'emily.davis@email.com', '555-0104', '321 Elm St, City', 'active'),
('LIB005', 'Michael Wilson', 'michael.w@email.com', '555-0105', '654 Maple Dr, City', 'inactive');

-- Insert sample transactions
INSERT IGNORE INTO transactions (book_id, member_id, issue_date, due_date, return_date, status, fine_amount) VALUES
(1, 1, '2024-01-15', '2024-01-29', '2024-01-28', 'returned', 0.00),
(2, 2, '2024-01-20', '2024-02-03', NULL, 'issued', 0.00),
(3, 3, '2024-01-10', '2024-01-24', '2024-01-25', 'returned', 1.00),
(4, 1, '2024-01-25', '2024-02-08', NULL, 'issued', 0.00),
(5, 4, '2024-01-18', '2024-02-01', NULL, 'overdue', 5.00);