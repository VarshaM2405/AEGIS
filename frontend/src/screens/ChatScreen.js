// ChatScreen — reusable thread for both SOS and report chat, keyed by route.params:
// { threadType: 'sos'|'report', threadId, otherPartyName, otherPartyPhone }. Poll/post
// follow the same 3s convention used everywhere else in this app (GlobalContext's
// nearby-SOS/active-SOS polls, HomeScreen's report poll) — no websockets.
import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Send } from 'lucide-react-native';
import { GlobalContext } from '../contexts/GlobalContext';
import { API_BASE_URL } from '../config';

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { threadType, threadId, otherPartyName, otherPartyPhone } = route.params || {};
  const { user, userProfile, normalizePhone } = useContext(GlobalContext);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const intervalRef = useRef(null);

  const myPhone = user?.phone;
  const myNormalizedPhone = normalizePhone(myPhone);

  const fetchMessages = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/messages?thread_type=${threadType}&thread_id=${threadId}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Chat fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!threadType || !threadId) return;
    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadType, threadId]);

  const handleSend = async () => {
    if (!draft.trim() || !myPhone) return;
    setSending(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_type: threadType,
          thread_id: threadId,
          sender_phone: myPhone,
          sender_name: userProfile.name || null,
          body: draft.trim(),
        }),
      });
      if (resp.ok) {
        setDraft('');
        await fetchMessages();
      }
    } catch (err) {
      console.error('Send message failed:', err);
    } finally {
      setSending(false);
    }
  };

  // sos-thread phones are normalized at write-time; report-thread phones are raw
  // (existing convention on IncidentReport) — match either way rather than assume one.
  const isMine = (msg) => msg.sender_phone === myPhone || normalizePhone(msg.sender_phone) === myNormalizedPhone;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F9' }}>
      <View className="flex-row items-center px-6 py-4 border-b border-[#E5B2B9]/40">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <ArrowLeft size={24} color="#4A2E35" />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-black text-[#4A2E35]">{otherPartyName || 'Chat'}</Text>
          {otherPartyPhone ? <Text className="text-[#9E7A80] text-xs">{otherPartyPhone}</Text> : null}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#D81B60" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 20, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Text className="text-[#9E7A80] text-center mt-10">No messages yet — say hello.</Text>}
          renderItem={({ item }) => {
            const mine = isMine(item);
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <View
                  style={{
                    maxWidth: '80%',
                    backgroundColor: mine ? '#D81B60' : '#FFFFFF',
                    borderWidth: mine ? 0 : 1,
                    borderColor: '#E5B2B9',
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: mine ? '#fff' : '#4A2E35' }}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View className="flex-row items-center px-4 py-3 border-t border-[#E5B2B9]/40 bg-white">
          <TextInput
            className="flex-1 bg-[#FAF5F5] rounded-full px-5 py-3 border border-[#E5B2B9]/50 text-[#4A2E35] mr-3"
            placeholder="Type a message..."
            placeholderTextColor="#9E7A80"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !draft.trim()}
            className="bg-[#D81B60] w-12 h-12 rounded-full items-center justify-center"
            style={{ opacity: sending || !draft.trim() ? 0.5 : 1 }}
          >
            <Send size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
