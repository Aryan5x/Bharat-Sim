import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../lib/auth';
import { c } from '../lib/theme';

export default function Index() {
  const { session, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.page }} />;
  return <Redirect href={session ? '/test' : '/sign-in'} />;
}
