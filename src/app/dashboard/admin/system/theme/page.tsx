
'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, Palette, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const themes = [
  { name: 'Light', value: 'light', icon: Sun },
  { name: 'Dark', value: 'dark', icon: Moon },
];

const colors = [
  { name: 'Red', value: '348 100% 59%' },
  { name: 'Blue', value: '221 83% 53%' },
  { name: 'Green', value: '142 76% 36%' },
  { name: 'Orange', value: '25 95% 53%' },
  { name: 'Violet', value: '262 83% 58%' },
];

export default function AdminThemePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [primaryColor, setPrimaryColor] = React.useState('348 100% 59%');

  React.useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    const currentPrimary = getComputedStyle(root).getPropertyValue('--primary').trim();
    setPrimaryColor(currentPrimary);
  }, []);

  const handleColorChange = (colorValue: string) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', colorValue);
    setPrimaryColor(colorValue);
  };

  if (!mounted) {
    return null; // or a skeleton loader
  }

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">System & Settings: Themes</h1>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette /> Appearance</CardTitle>
              <CardDescription>Select the theme for the dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {themes.map((t) => {
                const isActive = theme === t.value;
                return (
                  <div key={t.value}>
                    <Button
                      variant="outline"
                      className={cn('w-full h-24 flex-col gap-2', isActive && 'border-2 border-primary')}
                      onClick={() => setTheme(t.value)}
                    >
                      <t.icon className={cn('h-6 w-6', isActive ? 'text-primary' : 'text-muted-foreground')} />
                      {t.name}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette /> Theme Color</CardTitle>
              <CardDescription>Customize the accent color.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label>Accent Color</Label>
              <div className="flex flex-wrap gap-3">
                {colors.map((color) => {
                  const isActive = primaryColor === color.value;
                  return (
                    <Button
                      key={color.name}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      style={{ backgroundColor: `hsl(${color.value})` }}
                      onClick={() => handleColorChange(color.value)}
                    >
                      {isActive && <Check className="h-4 w-4 text-white" />}
                      <span className="sr-only">{color.name}</span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
