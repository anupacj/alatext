import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !username)) {
      setErrorMsg('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace('/');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert([
            { id: data.user.id, username, display_name: username }
          ]);
          if (profileError) console.error("Error creating profile:", profileError);
        }
        
        router.replace('/');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.background}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{isLogin ? 'Welcome back!' : 'Create an account'}</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'We\'re so excited to see you again!' : 'Join the ala chat community.'}
          </Text>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL <Text style={styles.asterisk}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                selectionColor="#5865F2"
              />
            </View>

            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>USERNAME <Text style={styles.asterisk}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  selectionColor="#5865F2"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD <Text style={styles.asterisk}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                selectionColor="#5865F2"
              />
              {isLogin && (
                <TouchableOpacity style={styles.forgotPassword}>
                  <Text style={styles.forgotText}>Forgot your password?</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleAuth} 
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>{isLogin ? 'Log In' : 'Continue'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isLogin ? 'Need an account? ' : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setErrorMsg(''); }}>
              <Text style={styles.linkText}>
                {isLogin ? 'Register' : 'Log In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#5865F2', // Classic Discord blurple background for login
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#313338',
    borderRadius: 8,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f2f3f5',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#b5bac1',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: {
    color: '#fa777c',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b5bac1',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  asterisk: {
    color: '#f23f43',
  },
  input: {
    backgroundColor: '#1e1f22',
    color: '#dbdee1',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  forgotPassword: {
    marginTop: 8,
  },
  forgotText: {
    color: '#00a8fc',
    fontSize: 13,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#5865F2', 
    borderRadius: 4,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'flex-start',
  },
  footerText: {
    color: '#949ba4',
    fontSize: 14,
  },
  linkText: {
    color: '#00a8fc',
    fontSize: 14,
    fontWeight: '500',
  },
});
