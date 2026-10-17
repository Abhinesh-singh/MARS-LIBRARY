const pool = require('../config/database');

const getDashboardStats = async (req, res, next) => {
  try {
    const [totalBooks] = await pool.execute('SELECT COUNT(*) as count FROM books');
    const [totalMembers] = await pool.execute('SELECT COUNT(*) as count FROM members WHERE status = "active"');
    const [issuedBooks] = await pool.execute('SELECT COUNT(*) as count FROM transactions WHERE status = "issued"');
    const [overdueBooks] = await pool.execute('SELECT COUNT(*) as count FROM transactions WHERE status = "overdue"');

    const [recentActivity] = await pool.execute(`
      SELECT 
        t.id,
        t.status,
        t.issue_date,
        t.due_date,
        t.return_date,
        b.title as book_title,
        m.full_name as member_name,
        m.member_id
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN members m ON t.member_id = m.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    const [categoryStats] = await pool.execute(`
      SELECT c.name as category, COUNT(b.id) as count
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `);

    const [monthlyTransactions] = await pool.execute(`
      SELECT 
        DATE_FORMAT(issue_date, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) as issued,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue
      FROM transactions
      WHERE issue_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
      ORDER BY month
    `);

    res.json({
      success: true,
      data: {
        stats: {
          totalBooks: totalBooks[0].count,
          totalMembers: totalMembers[0].count,
          issuedBooks: issuedBooks[0].count,
          overdueBooks: overdueBooks[0].count
        },
        recentActivity,
        categoryStats,
        monthlyTransactions
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardStats };