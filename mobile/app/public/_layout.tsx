import { Stack } from 'expo-router';

export default function PublicLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="verify/[token]" />
      <Stack.Screen name="equipment/[id]" />
    </Stack>
  );
}