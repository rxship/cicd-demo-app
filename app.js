const express = require('express');
const app = express();

app.use(express.json());

// In-memory "database" — just for demo purposes
let users = [
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' }
];

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'CI/CD Demo API', version: '2.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/users', (req, res) => {
  res.json(users);
});

app.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/users', (req, res) => {
  const { name, role } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const newUser = { id: users.length + 1, name, role: role || 'user' };
  users.push(newUser);
  res.status(201).json(newUser);
});

module.exports = app;  // Export for testing

// Only start the server if this file is run directly (not imported by tests)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

//demo push