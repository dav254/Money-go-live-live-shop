import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '../../src/theme';

/**
 * ADMIN STACK.
 *
 * Its own headers so the Command Centre reads as a workspace rather than a
 * settings page. The root stack shows this group without its own header.
 */
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: 'Admin',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
      <Stack.Screen name="sellers" options={{ title: 'Sellers' }} />
      <Stack.Screen name="market" options={{ title: 'Market' }} />
      <Stack.Screen name="finance" options={{ title: 'Finance' }} />
      <Stack.Screen name="safety" options={{ title: 'Safety' }} />
      <Stack.Screen name="growth" options={{ title: 'Growth' }} />
      <Stack.Screen name="intelligence" options={{ title: 'Intelligence' }} />
      <Stack.Screen name="developer" options={{ title: 'Developer' }} />
      <Stack.Screen name="chat" options={{ title: 'AI Chat' }} />
      <Stack.Screen name="ollama" options={{ title: 'Ollama' }} />
      <Stack.Screen name="paperclip" options={{ title: 'Paperclip' }} />
      <Stack.Screen name="instructions" options={{ title: 'Instruction Desk' }} />
      <Stack.Screen name="reports" options={{ title: 'Task Reports' }} />
      <Stack.Screen name="system" options={{ title: 'System Monitor' }} />
      <Stack.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Stack.Screen name="tasks" options={{ title: 'OpenCode Tasks' }} />
      <Stack.Screen name="task/[id]" options={{ title: 'Task Detail' }} />
    </Stack>
  );
}
