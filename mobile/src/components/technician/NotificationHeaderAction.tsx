import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { fetchNotifications } from '@/src/api/endpoints';
import { useTheme } from '@/src/theme/ThemeProvider';

export function NotificationHeaderAction() {
  const router = useRouter();
  const { t } = useTheme();
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    select: (response) => response.results,
    staleTime: 30000,
  });
  const unreadCount = notifications?.filter((item) => !item.read).length ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      onPress={() => router.push('/app/shared/notifications' as any)}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: t.tint,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Bell size={19} color={t.primary} strokeWidth={2.2} />
      {unreadCount > 0 ? (
        <View style={{ position: 'absolute', top: -3, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: t.bad, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
