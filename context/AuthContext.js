import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('fu_ubra_user');
      if (stored) setUser(JSON.parse(stored));
      setLoading(false);
    })();
  }, []);

  async function login(employeeId, password) {
    // POST /api/auth/login  -> { token, user: { name, employee_id, department, is_guard } }
    const res = await client.post('/auth/login', {
      employee_id: employeeId,
      password,
    });
    const { token, user: userData } = res.data;
    await AsyncStorage.setItem('fu_ubra_token', token);
    await AsyncStorage.setItem('fu_ubra_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }

  async function logout() {
    await AsyncStorage.multiRemove(['fu_ubra_token', 'fu_ubra_user']);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
