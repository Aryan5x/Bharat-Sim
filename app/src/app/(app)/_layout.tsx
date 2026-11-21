import { Redirect, Slot } from 'expo-router';
import { View } from 'react-native';
import { Shell } from '../../components/Shell';
import { useAuth } from '../../lib/auth';
import { c } from '../../lib/theme';

export default function AppLayout() {
  const { session, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.page }} />;
  if (!session) return <Redirect href="/sign-in" />;
  return (
    <Shell>
      <Slot />
    </Shell>
  );
}
