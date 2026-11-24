
/**
 * Service to handle user authentication and storage using localStorage.
 */

const USERS_KEY = 'users';

// Simple "hash" function using base64 encoding as requested for basic prototyping
export const hashPassword = (password) => {
  try {
    return btoa(password);
  } catch (e) {
    console.error("Error hashing password", e);
    return password;
  }
};

// Retrieve all users from localStorage
export const getUsers = () => {
  try {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
  } catch (e) {
    console.error("Error reading users from storage", e);
    return [];
  }
};

// Save a new user to localStorage
export const registerUser = ({ nome, email, usuario, senha }) => {
  const users = getUsers();
  
  // Check for duplicates
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Este e-mail já está cadastrado.');
  }
  
  if (users.some(u => u.usuario.toLowerCase() === usuario.toLowerCase())) {
    throw new Error('Este nome de usuário já existe.');
  }

  const newUser = {
    id: crypto.randomUUID(),
    nome,
    email,
    usuario,
    senhaHash: hashPassword(senha),
    createdAt: new Date().toISOString(),
    avatar: nome.substring(0, 2).toUpperCase()
  };

  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  
  // Return user without sensitive data
  const { senhaHash, ...safeUser } = newUser;
  return safeUser;
};

// Authenticate user against stored credentials
export const authenticateUser = (identifier, password) => {
  const users = getUsers();
  const target = identifier.toLowerCase();
  
  // Find user by email OR username
  const user = users.find(u => 
    u.email.toLowerCase() === target || 
    u.usuario.toLowerCase() === target
  );
  
  if (!user) {
    throw new Error('Usuário não encontrado.');
  }
  
  if (user.senhaHash !== hashPassword(password)) {
    throw new Error('Senha incorreta.');
  }
  
  // Return user without sensitive data
  const { senhaHash, ...safeUser } = user;
  return safeUser;
};
