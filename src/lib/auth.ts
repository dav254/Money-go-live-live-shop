
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Add your own authentication logic here
        if (credentials) {
          return {
            id: '1',
            name: 'Admin',
            email: 'admin@example.com',
          };
        } else {
          return null;
        }
      },
    }),
  ],
};
