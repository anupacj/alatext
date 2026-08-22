const fs = require('fs');
let content = fs.readFileSync('src/app/chat.tsx', 'utf8');

const newRenderMessage = \  const renderMessage = ({ item, index }: { item: any, index: number }) => {
    if (item.type === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>
            <Text style={{ fontWeight: 'bold' }}>{item.sender}</Text> {item.text}
          </Text>
        </View>
      );
    }
    
    // Inverted list: index + 1 is OLDER, index - 1 is NEWER
    const prevMsg = index < messages.length - 1 ? messages[index + 1] : null;
    const nextMsg = index > 0 ? messages[index - 1] : null;

    const isSameSenderAsPrev = prevMsg && prevMsg.sender === item.sender && prevMsg.type !== 'system';
    const isSameSenderAsNext = nextMsg && nextMsg.sender === item.sender && nextMsg.type !== 'system';

    const timeDiffPrev = prevMsg ? Math.abs(new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime()) : Infinity;
    const timeDiffNext = nextMsg ? Math.abs(new Date(item.created_at).getTime() - new Date(nextMsg.created_at).getTime()) : Infinity;

    const groupWithPrev = isSameSenderAsPrev && timeDiffPrev < 60000;
    const groupWithNext = isSameSenderAsNext && timeDiffNext < 60000;

    const showAvatarAndName = !groupWithNext;
    
    let bubbleStyle: any = [styles.messageBubble, item.isMe ? styles.messageBubbleRight : styles.messageBubbleLeft];
    
    if (item.isMe) {
      if (groupWithPrev) bubbleStyle.push({ borderTopRightRadius: 4 });
      if (groupWithNext) bubbleStyle.push({ borderBottomRightRadius: 4 });
    } else {
      if (groupWithPrev) bubbleStyle.push({ borderTopLeftRadius: 4 });
      if (groupWithNext) bubbleStyle.push({ borderBottomLeftRadius: 4 });
    }

    const isRead = item.isMe && targetUser?.last_read_at && new Date(item.created_at) <= new Date(targetUser.last_read_at);

    return (
      <Pressable 
        style={[
          styles.messageContainer, 
          item.isMe ? styles.messageContainerRight : styles.messageContainerLeft,
          groupWithNext ? { marginBottom: 2 } : { marginBottom: 18 }
        ]}
        onHoverIn={() => Platform.OS === 'web' && setHoveredMsg(item.id)}
        onHoverOut={() => Platform.OS === 'web' && setHoveredMsg(null)}
        onLongPress={() => setHoveredMsg(hoveredMsg === item.id ? null : item.id)}
      >
        {!item.isMe && (
          <View style={styles.avatarContainer}>
            {showAvatarAndName && (
              item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.messageAvatar} />
              ) : (
                <View style={[styles.messageAvatar, { justifyContent: 'center', alignItems: 'center' }]}>
                  <User size={20} color="#b5bac1" />
                </View>
              )
            )}
          </View>
        )}
        <View style={[styles.messageContent, item.isMe ? styles.messageContentRight : styles.messageContentLeft]}>
          {!item.isMe && showAvatarAndName && !groupWithPrev && (
            <View style={styles.messageHeader}>
              <Text style={styles.messageSender}>{item.sender}</Text>
            </View>
          )}
          <View style={bubbleStyle}>
            <Text style={[
              styles.messageText, 
              item.isMe ? styles.messageTextRight : styles.messageTextLeft,
              chatSettings?.font_family && chatSettings.font_family !== 'system' ? { fontFamily: chatSettings.font_family } : {}
            ]}>
              {item.text}
            </Text>
          </View>
          {item.isMe && showAvatarAndName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={styles.messageTimeRight}>{item.time}</Text>
              {isRead ? (
                <CheckCheck size={14} color="#5865F2" style={{ marginLeft: 4 }} />
              ) : (
                <Check size={14} color="#949ba4" style={{ marginLeft: 4 }} />
              )}
            </View>
          )}
          {!item.isMe && showAvatarAndName && (
            <Text style={[styles.messageTimeRight, { alignSelf: 'flex-start', marginTop: 4 }]}>{item.time}</Text>
          )}
        </View>
        
        {hoveredMsg === item.id && item.isMe && (
          <View style={styles.messageActions}>
            <TouchableOpacity 
              onPress={() => {
                setEditingMsgId(item.id);
                setInputText(item.text);
                setHoveredMsg(null);
              }} 
              style={styles.actionIcon}
            >
              <Edit2 size={16} color="#b5bac1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteMessage(item.id)} style={styles.actionIcon}>
              <Trash2 size={16} color="#f23f43" />
            </TouchableOpacity>
          </View>
        )}
      </Pressable>
    );
  };\;

const startIdx = content.indexOf('  const renderMessage = ({ item }: { item: any }) => {');
const endIdx = content.indexOf('  return (', startIdx);
const finalEndIdx = content.indexOf('    );', endIdx) + 6;

if (startIdx !== -1 && finalEndIdx !== -1) {
  content = content.substring(0, startIdx) + newRenderMessage + content.substring(finalEndIdx + 4);
  fs.writeFileSync('src/app/chat.tsx', content);
  console.log('Successfully replaced renderMessage');
} else {
  console.log('Could not find renderMessage bounds');
}
