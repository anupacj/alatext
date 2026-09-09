export const SLEEPY_BYE_QUOTES: string[] = [
  "All these byes just mean you don't want the night to end. Close your eyes now, it's time to rest. Goodnight, [username]. 🌙",
  "All these byes just mean it's time to rest. The conversation will be right here tomorrow. Goodnight, [username]. 🕯️",
  "Neither of you is actually going to leave, are you? Go to sleep. Sweet dreams, [username]. ✨",
  "Every 'bye' is just another way of saying stay. But for tonight, sleep well, [username]. 🤍",
  "That was your fifth 'final' bye in ten minutes. Put the phone down and rest, [username]. 🧸",
  "The world is quiet and so should you be. Rest easy, [username]. Tomorrow brings new stories. 🌌",
  "Don't worry, the chat won't run away overnight. Rest your eyes now, [username]. 🛌",
  "Saying goodbye is hard when the conversation is this sweet. But the pillow calls. Rest peacefully, [username]. 🍯",
  "Look at you two, lingering in the doorway of sleep. Step inside. Sweet dreams, [username]. 🚪",
  "Even the moon thinks you two should be asleep by now. Close the screen, [username]. 🌙",
  "All good chapters pause for a night of rest. Bookmark this page and sleep well, [username]. 📖",
  "You can pick right back up where you left off with morning coffee. Rest now, [username]. ☕",
  "No more byes allowed tonight. Only deep breaths and soft pillows. Goodnight, [username]. ☁️",
  "At this rate, your 'goodnight' is going to bump right into their 'good morning'. Go to sleep, [username]. ⏰",
  "The conversation was wonderful, but your pillow misses you more. Rest peacefully, [username]. 🪶",
  "A circle of byes with no exit in sight. Allow me to close the door for you. Sleep well, [username]. 🚪✨",
  "Soft thoughts, quiet night, warm blankets. You've earned your rest, [username]. 🕯️",
  "That's officially enough byes to knit a whole sweater. Get some sleep, [username]. 🧶",
  "It's safe to let go of the screen now. The universe will still be spinning tomorrow. Goodnight, [username]. 🪐",
  "The best conversations don't end—they just rest until tomorrow. Sweet dreams, [username]. 🌿",
  "Some conversations are hard to leave, but sleep is waiting with open arms. Rest sweet, [username]. 🫂",
  "The stars have been on duty for hours waiting for you to turn off this screen. Goodnight, [username]. 🌠",
  "May your dreams be as gentle and kind as the words you shared tonight. Sleep softly, [username]. 🌸",
  "The night is wrapping everything in velvet silence. Let yourself drift off, [username]. 🕊️",
  "If byes were pennies, you'd both be rich by now. Save the rest for tomorrow. Goodnight, [username]. 🪙",
  "You don't have to say the final word. Just let the silence be peaceful. Sleep well, [username]. 🤍",
  "Between words and sleep lies a quiet moment just for you. Rest now, [username]. 🪶",
  "The best messages are the ones you wake up to. Go find out in the morning. Rest now, [username]. 💌",
  "Shut your eyes and let the warmth of this conversation tuck you in. Sweet dreams, [username]. 🛌",
  "End of the line, sleepyhead. Phone down, eyes closed. Goodnight, [username]. 💤"
];

/**
 * Returns today's designated quote from the 30 curated lines,
 * mapped to the day of the month (1-31) and personalized with [username].
 */
export function getDailyByeQuote(username?: string): string {
  const day = new Date().getDate(); // 1 - 31
  const index = (day - 1) % SLEEPY_BYE_QUOTES.length;
  const rawQuote = SLEEPY_BYE_QUOTES[index];
  const safeName = username?.trim() || "sleepyhead";
  return rawQuote.replace(/\[username\]/g, safeName);
}
