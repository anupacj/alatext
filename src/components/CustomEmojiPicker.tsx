import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Dimensions,
  Platform,
  ScrollView,
} from "react-native";
import { Search, X, Clock, Smile, Heart, User, Sparkles, Coffee, Trophy, Car, Hash } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface EmojiItem {
  emoji: string;
  name: string;
  category: string;
}

const CATEGORIES = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "smileys", label: "Smileys", icon: Smile },
  { id: "hearts", label: "Hearts", icon: Heart },
  { id: "people", label: "People", icon: User },
  { id: "nature", label: "Nature", icon: Sparkles },
  { id: "food", label: "Food", icon: Coffee },
  { id: "activities", label: "Activity", icon: Trophy },
  { id: "travel", label: "Travel", icon: Car },
  { id: "symbols", label: "Symbols", icon: Hash },
];

const EMOJI_DATABASE: EmojiItem[] = [
  // Smileys & Emotion
  { emoji: "😀", name: "grinning face happy smile", category: "smileys" },
  { emoji: "😃", name: "grinning face with big eyes happy smile", category: "smileys" },
  { emoji: "😄", name: "grinning face with smiling eyes smile happy", category: "smileys" },
  { emoji: "😁", name: "beaming face with smiling eyes grin happy", category: "smileys" },
  { emoji: "😆", name: "grinning squinting face haha laugh", category: "smileys" },
  { emoji: "😅", name: "grinning face with sweat phew nervous", category: "smileys" },
  { emoji: "😂", name: "face with tears of joy laugh haha lol cry", category: "smileys" },
  { emoji: "🤣", name: "rolling on the floor laughing rofl lol haha", category: "smileys" },
  { emoji: "🥲", name: "smiling face with tear bittersweet sad happy", category: "smileys" },
  { emoji: "🥹", name: "face holding back tears emotional touched", category: "smileys" },
  { emoji: "☺️", name: "smiling face blush calm", category: "smileys" },
  { emoji: "😊", name: "smiling face with smiling eyes happy blush", category: "smileys" },
  { emoji: "😇", name: "smiling face with halo angel innocent", category: "smileys" },
  { emoji: "🙂", name: "slightly smiling face ok calm", category: "smileys" },
  { emoji: "🙃", name: "upside down face silly sarcastic", category: "smileys" },
  { emoji: "😉", name: "winking face wink playful", category: "smileys" },
  { emoji: "😌", name: "relieved face peaceful relaxed", category: "smileys" },
  { emoji: "😍", name: "smiling face with heart eyes love adore", category: "smileys" },
  { emoji: "🥰", name: "smiling face with hearts love affectionate", category: "smileys" },
  { emoji: "😘", name: "face blowing a kiss kiss love muah", category: "smileys" },
  { emoji: "😗", name: "kissing face kiss", category: "smileys" },
  { emoji: "😙", name: "kissing face with smiling eyes kiss cute", category: "smileys" },
  { emoji: "😚", name: "kissing face with closed eyes kiss blush", category: "smileys" },
  { emoji: "😋", name: "face savoring food yummy delicious tongue", category: "smileys" },
  { emoji: "😛", name: "face with tongue playful silly", category: "smileys" },
  { emoji: "😝", name: "squinting face with tongue haha goofy", category: "smileys" },
  { emoji: "😜", name: "winking face with tongue crazy playful wink", category: "smileys" },
  { emoji: "🤪", name: "zany face wild crazy goofy", category: "smileys" },
  { emoji: "🤨", name: "face with raised eyebrow suspicious skeptic", category: "smileys" },
  { emoji: "🧐", name: "face with monocle curious detective examine", category: "smileys" },
  { emoji: "🤓", name: "nerd face smart geek glasses", category: "smileys" },
  { emoji: "😎", name: "smiling face with sunglasses cool awesome", category: "smileys" },
  { emoji: "🥸", name: "disguised face glasses mustache spy", category: "smileys" },
  { emoji: "🤩", name: "star struck excited amazed sparkle", category: "smileys" },
  { emoji: "🥳", name: "partying face celebrate party birthday", category: "smileys" },
  { emoji: "😏", name: "smirking face smirk flirt sly", category: "smileys" },
  { emoji: "😒", name: "unamused face annoyed bored unimpressed", category: "smileys" },
  { emoji: "😞", name: "disappointed face sad upset", category: "smileys" },
  { emoji: "😔", name: "pensive face sorrowful sad down", category: "smileys" },
  { emoji: "😟", name: "worried face nervous concern", category: "smileys" },
  { emoji: "😕", name: "confused face puzzled huh", category: "smileys" },
  { emoji: "🙁", name: "slightly frowning face sad", category: "smileys" },
  { emoji: "☹️", name: "frowning face unhappy sad", category: "smileys" },
  { emoji: "😣", name: "persevering face struggle endure", category: "smileys" },
  { emoji: "😖", name: "confounded face frustrated annoyed", category: "smileys" },
  { emoji: "😫", name: "tired face exhausted weary", category: "smileys" },
  { emoji: "😩", name: "weary face overwhelmed tired", category: "smileys" },
  { emoji: "🥺", name: "pleading face puppy eyes beg cute please", category: "smileys" },
  { emoji: "😢", name: "crying face sad tear cry", category: "smileys" },
  { emoji: "😭", name: "loudly crying face sob weep tears cry", category: "smileys" },
  { emoji: "😮‍💨", name: "face exhaling sigh relief tired", category: "smileys" },
  { emoji: "😤", name: "face with steam from nose proud angry", category: "smileys" },
  { emoji: "😠", name: "angry face mad upset grr", category: "smileys" },
  { emoji: "😡", name: "pouting face rage fury angry red", category: "smileys" },
  { emoji: "🤬", name: "face with symbols on mouth swear curse angry", category: "smileys" },
  { emoji: "🤯", name: "exploding head mind blown shocked", category: "smileys" },
  { emoji: "😳", name: "flushed face blush shocked embarrassed", category: "smileys" },
  { emoji: "🥵", name: "hot face sweat summer heat", category: "smileys" },
  { emoji: "🥶", name: "cold face freezing ice winter", category: "smileys" },
  { emoji: "😱", name: "face screaming in fear scream shocked panic", category: "smileys" },
  { emoji: "😨", name: "fearful face scared frightened", category: "smileys" },
  { emoji: "😰", name: "anxious face with sweat nervous worry", category: "smileys" },
  { emoji: "😥", name: "sad but relieved face whew", category: "smileys" },
  { emoji: "😓", name: "downcast face with sweat stress tired", category: "smileys" },
  { emoji: "🤗", name: "smiling face with open hands hug warmth", category: "smileys" },
  { emoji: "🤔", name: "thinking face think hmm consider", category: "smileys" },
  { emoji: "🫣", name: "face with peeking eye shy peek scared", category: "smileys" },
  { emoji: "🤭", name: "face with hand over mouth oops giggle teehee", category: "smileys" },
  { emoji: "🫢", name: "face with open eyes and hand over mouth gasp surprise", category: "smileys" },
  { emoji: "🫡", name: "saluting face respect salute yes sir", category: "smileys" },
  { emoji: "🤫", name: "shushing face quiet silence secret hush", category: "smileys" },
  { emoji: "🫠", name: "melting face hot disappear sarcasm", category: "smileys" },
  { emoji: "🤥", name: "lying face pinocchio liar fake", category: "smileys" },
  { emoji: "😶", name: "face without mouth silent blank", category: "smileys" },
  { emoji: "😶‍🌫️", name: "face in clouds lost daydream fog", category: "smileys" },
  { emoji: "😐", name: "neutral face poker deadpan straight", category: "smileys" },
  { emoji: "😑", name: "expressionless face unamused blank", category: "smileys" },
  { emoji: "😬", name: "grimacing face awkward cringe eek", category: "smileys" },
  { emoji: "🫨", name: "shaking face shock earthquake dizzy", category: "smileys" },
  { emoji: "🙄", name: "face with rolling eyes eye roll whatever annoyed", category: "smileys" },
  { emoji: "😯", name: "hushed face surprised wow", category: "smileys" },
  { emoji: "😦", name: "frowning face with open mouth shocked", category: "smileys" },
  { emoji: "😧", name: "anguished face upset stunned", category: "smileys" },
  { emoji: "😮", name: "face with open mouth oh wow surprise", category: "smileys" },
  { emoji: "😲", name: "astonished face omg shocked amazed", category: "smileys" },
  { emoji: "🥱", name: "yawning face sleepy bored tired yawn", category: "smileys" },
  { emoji: "😴", name: "sleeping face sleep zzz rest bed", category: "smileys" },
  { emoji: "🤤", name: "drooling face crave delicious sleep", category: "smileys" },
  { emoji: "😪", name: "sleepy face tired tear rest", category: "smileys" },
  { emoji: "😵", name: "face with crossed out eyes knocked out dead dizzy", category: "smileys" },
  { emoji: "😵‍💫", name: "face with spiral eyes dizzy confused", category: "smileys" },
  { emoji: "🫥", name: "dotted line face invisible fade disappear", category: "smileys" },
  { emoji: "🤐", name: "zipper mouth face secret sealed quiet", category: "smileys" },
  { emoji: "🥴", name: "woozy face drunk tipsy dizzy", category: "smileys" },
  { emoji: "🤢", name: "nauseated face sick green vomit disgust", category: "smileys" },
  { emoji: "🤮", name: "face vomiting puke throw up gross", category: "smileys" },
  { emoji: "🤧", name: "sneezing face sneeze tissue sick cold", category: "smileys" },
  { emoji: "😷", name: "face with medical mask mask sick covid", category: "smileys" },
  { emoji: "🤒", name: "face with thermometer fever sick unwell", category: "smileys" },
  { emoji: "🤕", name: "face with head bandage hurt injured bandage", category: "smileys" },
  { emoji: "🤑", name: "money mouth face rich cash dollar wealthy", category: "smileys" },
  { emoji: "🤠", name: "cowboy hat face western sheriff yeehaw", category: "smileys" },
  { emoji: "😈", name: "smiling face with horns devil evil naughty", category: "smileys" },
  { emoji: "👿", name: "angry face with horns demon mad evil", category: "smileys" },
  { emoji: "👹", name: "ogre monster japanese demon", category: "smileys" },
  { emoji: "👺", name: "goblin mask red tengu", category: "smileys" },
  { emoji: "🤡", name: "clown face circus funny foolish", category: "smileys" },
  { emoji: "💩", name: "pile of poo poop crap funny", category: "smileys" },
  { emoji: "👻", name: "ghost spooky halloween boo spirit", category: "smileys" },
  { emoji: "💀", name: "skull dead skeleton death rip die", category: "smileys" },
  { emoji: "☠️", name: "skull and crossbones poison pirate danger", category: "smileys" },
  { emoji: "👽", name: "alien ufo extraterrestrial martian", category: "smileys" },
  { emoji: "👾", name: "alien monster 8bit video game arcade", category: "smileys" },
  { emoji: "🤖", name: "robot face bot android tech", category: "smileys" },
  { emoji: "🎃", name: "jack o lantern pumpkin halloween fall", category: "smileys" },
  { emoji: "😺", name: "grinning cat happy smile", category: "smileys" },
  { emoji: "😸", name: "grinning cat with smiling eyes happy", category: "smileys" },
  { emoji: "😹", name: "cat with tears of joy haha lol laugh", category: "smileys" },
  { emoji: "😻", name: "smiling cat with heart eyes love cute", category: "smileys" },
  { emoji: "😼", name: "cat with wry smile smirk", category: "smileys" },
  { emoji: "😽", name: "kissing cat kiss love", category: "smileys" },
  { emoji: "🙀", name: "weary cat shocked surprise omg", category: "smileys" },
  { emoji: "😿", name: "crying cat sad tear", category: "smileys" },
  { emoji: "😾", name: "pouting cat angry mad", category: "smileys" },

  // Hearts & Romance
  { emoji: "❤️", name: "red heart love romance passion", category: "hearts" },
  { emoji: "🧡", name: "orange heart love warmth", category: "hearts" },
  { emoji: "💛", name: "yellow heart love friendship sunshine", category: "hearts" },
  { emoji: "💚", name: "green heart love nature organic", category: "hearts" },
  { emoji: "💙", name: "blue heart love peace trust", category: "hearts" },
  { emoji: "💜", name: "purple heart love charm royalty", category: "hearts" },
  { emoji: "🖤", name: "black heart love gothic dark", category: "hearts" },
  { emoji: "🤍", name: "white heart pure love peace", category: "hearts" },
  { emoji: "🤎", name: "brown heart love coffee chocolate", category: "hearts" },
  { emoji: "💔", name: "broken heart sad heartbreak breakup", category: "hearts" },
  { emoji: "❤️‍🔥", name: "heart on fire passion intense burning love", category: "hearts" },
  { emoji: "❤️‍🩹", name: "mending heart healing recovery better", category: "hearts" },
  { emoji: "❣️", name: "heart exclamation punctuation emphasis", category: "hearts" },
  { emoji: "💕", name: "two hearts affection pink love", category: "hearts" },
  { emoji: "💞", name: "revolving hearts swirl love romantic", category: "hearts" },
  { emoji: "💓", name: "beating heart pulse love excited", category: "hearts" },
  { emoji: "💗", name: "growing heart expand love sparkle", category: "hearts" },
  { emoji: "💖", name: "sparkling heart sparkle shiny love", category: "hearts" },
  { emoji: "💘", name: "heart with arrow cupid arrow romance", category: "hearts" },
  { emoji: "💝", name: "heart with ribbon gift present love", category: "hearts" },
  { emoji: "💟", name: "heart decoration purple badge", category: "hearts" },
  { emoji: "💌", name: "love letter envelope romance note", category: "hearts" },
  { emoji: "💋", name: "kiss mark lips lipstick romance", category: "hearts" },
  { emoji: "🫂", name: "people hugging hug comfort embrace", category: "hearts" },

  // People & Body
  { emoji: "👋", name: "waving hand wave hello goodbye hi", category: "people" },
  { emoji: "🤚", name: "raised back of hand stop high five", category: "people" },
  { emoji: "🖐️", name: "hand with fingers splayed five palm", category: "people" },
  { emoji: "✋", name: "raised hand stop high five palm", category: "people" },
  { emoji: "🖖", name: "vulcan salute spock star trek live long", category: "people" },
  { emoji: "👌", name: "ok hand okay perfect fine good", category: "people" },
  { emoji: "🤌", name: "pinched fingers italian chef kiss what", category: "people" },
  { emoji: "🤏", name: "pinching hand tiny small little bit", category: "people" },
  { emoji: "✌️", name: "victory hand peace two v sign", category: "people" },
  { emoji: "🤞", name: "crossed fingers luck hope wish", category: "people" },
  { emoji: "🫰", name: "hand with index finger and thumb crossed korean finger heart money", category: "people" },
  { emoji: "🤟", name: "love you gesture ily rock sign language", category: "people" },
  { emoji: "🤘", name: "sign of the horns rock on metal heavy", category: "people" },
  { emoji: "🤙", name: "call me hand shaka hang loose phone", category: "people" },
  { emoji: "👈", name: "backhand index pointing left point look", category: "people" },
  { emoji: "👉", name: "backhand index pointing right point this", category: "people" },
  { emoji: "👆", name: "backhand index pointing up point above", category: "people" },
  { emoji: "🖕", name: "middle finger flip off rude offensive", category: "people" },
  { emoji: "👇", name: "backhand index pointing down point below", category: "people" },
  { emoji: "☝️", name: "index pointing up one first listen", category: "people" },
  { emoji: "🫵", name: "index pointing at the viewer you uncle sam", category: "people" },
  { emoji: "👍", name: "thumbs up good like approve yes agree", category: "people" },
  { emoji: "👎", name: "thumbs down bad dislike disapprove no", category: "people" },
  { emoji: "✊", name: "raised fist punch power solid", category: "people" },
  { emoji: "👊", name: "oncoming fist punch fist bump bro", category: "people" },
  { emoji: "🤛", name: "left facing fist bump", category: "people" },
  { emoji: "🤜", name: "right facing fist bump", category: "people" },
  { emoji: "👏", name: "clapping hands clap bravo applaud praise", category: "people" },
  { emoji: "🙌", name: "raising hands celebrate praise hooray yay", category: "people" },
  { emoji: "🫶", name: "heart hands love hand sign shape", category: "people" },
  { emoji: "👐", name: "open hands hug welcome", category: "people" },
  { emoji: "🤲", name: "palms up together pray offer hope", category: "people" },
  { emoji: "🤝", name: "handshake agreement deal partnership meet", category: "people" },
  { emoji: "🙏", name: "folded hands please thank you pray namaste amen", category: "people" },
  { emoji: "✍️", name: "writing hand write pen note exam", category: "people" },
  { emoji: "💅", name: "nail polish manicure sassy diva chill", category: "people" },
  { emoji: "🤳", name: "selfie camera photo pose", category: "people" },
  { emoji: "💪", name: "flexed biceps strong muscle gym power fitness", category: "people" },
  { emoji: "👀", name: "eyes look see stare watch peep", category: "people" },
  { emoji: "👁️", name: "eye see vision look", category: "people" },
  { emoji: "👅", name: "tongue lick taste mouth", category: "people" },
  { emoji: "👄", name: "mouth lips kiss lipstick speak", category: "people" },
  { emoji: "🧠", name: "brain smart think mind intelligence", category: "people" },
  { emoji: "👶", name: "baby infant newborn child", category: "people" },
  { emoji: "👧", name: "girl child daughter female", category: "people" },
  { emoji: "👦", name: "boy child son male", category: "people" },
  { emoji: "👩", name: "woman lady female adult", category: "people" },
  { emoji: "👨", name: "man gentleman male adult", category: "people" },
  { emoji: "🧑‍💻", name: "technologist developer coder hacker laptop programmer", category: "people" },
  { emoji: "👑", name: "crown king queen royal royalty prince princess", category: "people" },

  // Nature & Animals
  { emoji: "🐶", name: "dog face puppy pet animal bark woof", category: "nature" },
  { emoji: "🐱", name: "cat face kitten kitty pet meow animal", category: "nature" },
  { emoji: "🐭", name: "mouse face rodent squeak", category: "nature" },
  { emoji: "🐹", name: "hamster face cute pet rodent", category: "nature" },
  { emoji: "🐰", name: "rabbit face bunny easter cute animal", category: "nature" },
  { emoji: "🦊", name: "fox face wild clever animal", category: "nature" },
  { emoji: "🐻", name: "bear face grizzly teddy animal", category: "nature" },
  { emoji: "🐼", name: "panda face giant bamboo cute animal", category: "nature" },
  { emoji: "🐨", name: "koala bear australia cute animal", category: "nature" },
  { emoji: "🐯", name: "tiger face wild cat predator roar", category: "nature" },
  { emoji: "🦁", name: "lion face king jungle predator roar", category: "nature" },
  { emoji: "🐮", name: "cow face moo farm dairy", category: "nature" },
  { emoji: "🐷", name: "pig face oink farm pork", category: "nature" },
  { emoji: "🐸", name: "frog face toad ribbit amphibian green", category: "nature" },
  { emoji: "🐵", name: "monkey face primate animal chimp", category: "nature" },
  { emoji: "🙈", name: "see no evil monkey shy hide avoid", category: "nature" },
  { emoji: "🙉", name: "hear no evil monkey loud quiet", category: "nature" },
  { emoji: "🙊", name: "speak no evil monkey quiet secret gasp", category: "nature" },
  { emoji: "🐔", name: "chicken rooster cluck farm bird", category: "nature" },
  { emoji: "🐧", name: "penguin bird ice arctic cute", category: "nature" },
  { emoji: "🐦", name: "bird tweet fly nature animal", category: "nature" },
  { emoji: "🐤", name: "baby chick yellow bird hatch", category: "nature" },
  { emoji: "🦆", name: "duck quack bird pond", category: "nature" },
  { emoji: "🦅", name: "eagle bird predator freedom usa", category: "nature" },
  { emoji: "🦉", name: "owl wise night bird nocturnal", category: "nature" },
  { emoji: "🦇", name: "bat vampire night halloween cave", category: "nature" },
  { emoji: "🐺", name: "wolf face howl wild pack animal", category: "nature" },
  { emoji: "🐴", name: "horse face stallion pony equestrian", category: "nature" },
  { emoji: "🦄", name: "unicorn magic fantasy horn rainbow", category: "nature" },
  { emoji: "🐝", name: "honeybee bee honey buzz insect sting", category: "nature" },
  { emoji: "🐛", name: "bug caterpillar insect garden", category: "nature" },
  { emoji: "🦋", name: "butterfly beauty wings insect cocoon", category: "nature" },
  { emoji: "🐌", name: "snail slow shell slimy", category: "nature" },
  { emoji: "🐞", name: "lady beetle ladybug insect spot red", category: "nature" },
  { emoji: "🐜", name: "ant insect colony bug", category: "nature" },
  { emoji: "🕷️", name: "spider web arachnid creepy halloween", category: "nature" },
  { emoji: "🦂", name: "scorpion sting zodiac desert dangerous", category: "nature" },
  { emoji: "🐢", name: "turtle tortoise reptile slow shell", category: "nature" },
  { emoji: "🐍", name: "snake serpent reptile slither danger", category: "nature" },
  { emoji: "🐙", name: "octopus tentacle sea ocean creature", category: "nature" },
  { emoji: "🦀", name: "crab seafood ocean zodiac beach", category: "nature" },
  { emoji: "🐠", name: "tropical fish aquarium ocean nemo", category: "nature" },
  { emoji: "🐟", name: "fish swim water seafood ocean", category: "nature" },
  { emoji: "🐬", name: "dolphin sea ocean intelligent marine", category: "nature" },
  { emoji: "🐳", name: "spouting whale ocean huge mammal", category: "nature" },
  { emoji: "🦈", name: "shark jaws ocean predator teeth", category: "nature" },
  { emoji: "🌸", name: "cherry blossom flower bloom spring sakura pink", category: "nature" },
  { emoji: "🌹", name: "rose flower red romance love plant", category: "nature" },
  { emoji: "🌺", name: "hibiscus tropical flower hawaii", category: "nature" },
  { emoji: "🌻", name: "sunflower yellow summer sunshine plant", category: "nature" },
  { emoji: "🌼", name: "blossom yellow flower bloom spring", category: "nature" },
  { emoji: "🌷", name: "tulip flower garden holland spring", category: "nature" },
  { emoji: "🌱", name: "seedling plant grow sprout green fresh", category: "nature" },
  { emoji: "🌲", name: "evergreen tree pine forest nature christmas", category: "nature" },
  { emoji: "🌳", name: "deciduous tree nature plant wood green", category: "nature" },
  { emoji: "🌴", name: "palm tree tropical island beach vacation summer", category: "nature" },
  { emoji: "🌵", name: "cactus desert plant spike southwest", category: "nature" },
  { emoji: "🍀", name: "four leaf clover lucky st patrick fortune", category: "nature" },
  { emoji: "🍁", name: "maple leaf fall autumn canada foliage", category: "nature" },
  { emoji: "🍂", name: "fallen leaf autumn fall season wind", category: "nature" },
  { emoji: "🍃", name: "leaf fluttering in wind breeze nature green", category: "nature" },
  { emoji: "🍄", name: "mushroom fungus toadstool mario forest", category: "nature" },
  { emoji: "🔥", name: "fire flame lit hot burn blaze", category: "nature" },
  { emoji: "✨", name: "sparkles shiny magical stars glitter star", category: "nature" },
  { emoji: "⭐️", name: "star yellow night sky award rate", category: "nature" },
  { emoji: "🌟", name: "glowing star shine bright twinkle", category: "nature" },
  { emoji: "⚡️", name: "high voltage lightning electric storm shock power", category: "nature" },
  { emoji: "☀️", name: "sun sunny weather bright warm summer", category: "nature" },
  { emoji: "☁️", name: "cloud overcast weather sky overcast", category: "nature" },
  { emoji: "🌧️", name: "cloud with rain rainy wet storm shower", category: "nature" },
  { emoji: "❄️", name: "snowflake snow cold winter frost ice", category: "nature" },
  { emoji: "🌈", name: "rainbow weather color pride sky colorful", category: "nature" },
  { emoji: "🌊", name: "water wave ocean sea tsunami surf beach", category: "nature" },

  // Food & Drink
  { emoji: "🍏", name: "green apple fruit diet health", category: "food" },
  { emoji: "🍎", name: "red apple fruit school teacher", category: "food" },
  { emoji: "🍐", name: "pear fruit green sweet", category: "food" },
  { emoji: "🍊", name: "tangerine orange citrus vitamin c", category: "food" },
  { emoji: "🍋", name: "lemon sour citrus yellow sour", category: "food" },
  { emoji: "🍌", name: "banana fruit monkey potassium", category: "food" },
  { emoji: "🍉", name: "watermelon fruit summer melon slice", category: "food" },
  { emoji: "🍇", name: "grapes wine fruit purple bunch", category: "food" },
  { emoji: "🍓", name: "strawberry berry fruit sweet red", category: "food" },
  { emoji: "🫐", name: "blueberries berry fruit blue sweet", category: "food" },
  { emoji: "🍒", name: "cherries fruit red sweet pair", category: "food" },
  { emoji: "🍑", name: "peach fruit butt sweet juicy", category: "food" },
  { emoji: "🥭", name: "mango tropical fruit sweet juicy", category: "food" },
  { emoji: "🍍", name: "pineapple tropical fruit hawaii", category: "food" },
  { emoji: "🥥", name: "coconut tropical fruit palm water", category: "food" },
  { emoji: "🥑", name: "avocado toast guacamole green fruit", category: "food" },
  { emoji: "🍅", name: "tomato vegetable salad pasta red", category: "food" },
  { emoji: "🥔", name: "potato food fry carb spud vegetable", category: "food" },
  { emoji: "🥕", name: "carrot vegetable rabbit orange food", category: "food" },
  { emoji: "🌽", name: "ear of corn maize vegetable popcorn", category: "food" },
  { emoji: "🌶️", name: "hot pepper chili spicy seasoning heat", category: "food" },
  { emoji: "🍞", name: "bread loaf bakery toast carb", category: "food" },
  { emoji: "🥐", name: "croissant bakery french pastry butter", category: "food" },
  { emoji: "🧀", name: "cheese wedge dairy gouda cheddar swiss", category: "food" },
  { emoji: "🍳", name: "cooking egg fry breakfast pan skillet", category: "food" },
  { emoji: "🥓", name: "bacon breakfast pork meat fry", category: "food" },
  { emoji: "🥩", name: "cut of meat steak beef dinner", category: "food" },
  { emoji: "🍗", name: "poultry leg chicken drumstick meat dinner", category: "food" },
  { emoji: "🌭", name: "hot dog sausage fast food bun mustard", category: "food" },
  { emoji: "🍔", name: "hamburger burger fast food beef cheeseburger", category: "food" },
  { emoji: "🍟", name: "french fries fast food potato chips fry", category: "food" },
  { emoji: "🍕", name: "pizza slice cheese pepperoni fast food", category: "food" },
  { emoji: "🥪", name: "sandwich lunch deli bread subway", category: "food" },
  { emoji: "🌮", name: "taco mexican food shell meat salsa", category: "food" },
  { emoji: "🌯", name: "burrito wrap mexican food roll", category: "food" },
  { emoji: "🥗", name: "green salad healthy diet vegetables", category: "food" },
  { emoji: "🍝", name: "spaghetti pasta noodle italian dinner", category: "food" },
  { emoji: "🍜", name: "steaming bowl ramen noodles soup asian", category: "food" },
  { emoji: "🍛", name: "curry rice indian japanese dinner spice", category: "food" },
  { emoji: "🍣", name: "sushi japanese seafood raw fish roll", category: "food" },
  { emoji: "🍱", name: "bento box japanese lunch meal meal", category: "food" },
  { emoji: "🥟", name: "dumpling dim sum potsticker asian", category: "food" },
  { emoji: "🍦", name: "soft ice cream dessert dairy cone sweet", category: "food" },
  { emoji: "🍩", name: "doughnut donut bakery sweet pastry glazes", category: "food" },
  { emoji: "🍪", name: "cookie biscuit chocolate chip sweet bakery", category: "food" },
  { emoji: "🎂", name: "birthday cake celebration party dessert sweet", category: "food" },
  { emoji: "🍰", name: "shortcake cake dessert strawberry sweet", category: "food" },
  { emoji: "🧁", name: "cupcake dessert bakery sweet frosting", category: "food" },
  { emoji: "🍫", name: "chocolate bar candy sweet cocoa dessert", category: "food" },
  { emoji: "🍬", name: "candy sweet treat sugar confection", category: "food" },
  { emoji: "🍭", name: "lollipop candy sweet sugar treat", category: "food" },
  { emoji: "🍿", name: "popcorn cinema movie snack butter corn", category: "food" },
  { emoji: "☕️", name: "hot beverage coffee tea espresso cafe morning", category: "food" },
  { emoji: "🍵", name: "teacup without handle green tea matcha cafe", category: "food" },
  { emoji: "🧋", name: "bubble tea boba milk tea drink tapioca", category: "food" },
  { emoji: "🥤", name: "cup with straw soda drink drink cola beverage", category: "food" },
  { emoji: "🍺", name: "beer mug alcohol pub drink toast", category: "food" },
  { emoji: "🍻", name: "clinking beer mugs cheers toast alcohol party", category: "food" },
  { emoji: "🍷", name: "wine glass red alcohol drink bar dinner", category: "food" },
  { emoji: "🍸", name: "cocktail glass martini alcohol drink bar", category: "food" },
  { emoji: "🍹", name: "tropical drink cocktail alcohol summer vacation", category: "food" },
  { emoji: "🍾", name: "bottle with popping cork champagne celebration toast party", category: "food" },

  // Activity & Sports
  { emoji: "⚽️", name: "soccer ball football sport game kick", category: "activities" },
  { emoji: "🏀", name: "basketball ball sport game hoop nba", category: "activities" },
  { emoji: "🏈", name: "american football ball nfl sport game", category: "activities" },
  { emoji: "⚾️", name: "baseball ball sport game mlb pitch", category: "activities" },
  { emoji: "🎾", name: "tennis ball racket court sport match", category: "activities" },
  { emoji: "🏐", name: "volleyball ball beach court sport", category: "activities" },
  { emoji: "🎱", name: "pool 8 ball billiard game eight", category: "activities" },
  { emoji: "🏓", name: "ping pong table tennis paddle ball", category: "activities" },
  { emoji: "🏸", name: "badminton shuttlecock racket sport", category: "activities" },
  { emoji: "🥊", name: "boxing glove punch fight workout", category: "activities" },
  { emoji: "🎯", name: "bullseye direct hit target arrow dart goal", category: "activities" },
  { emoji: "🎮", name: "video game controller console gamer play playstation xbox", category: "activities" },
  { emoji: "🎲", name: "game die dice roll gambling casino board", category: "activities" },
  { emoji: "🧩", name: "puzzle piece jigsaw game solve problem", category: "activities" },
  { emoji: "🎨", name: "artist palette art painting draw creative color", category: "activities" },
  { emoji: "🎬", name: "clapper board movie film cinema director act", category: "activities" },
  { emoji: "🎤", name: "microphone singing music karaoke podcast host", category: "activities" },
  { emoji: "🎧", name: "headphone music audio listen sound beat", category: "activities" },
  { emoji: "🎹", name: "musical keyboard piano instrument song tune", category: "activities" },
  { emoji: "🥁", name: "drum beat instrument percussion music rock", category: "activities" },
  { emoji: "🎷", name: "saxophone jazz brass instrument music song", category: "activities" },
  { emoji: "🎸", name: "guitar acoustic rock music instrument song", category: "activities" },
  { emoji: "🏆", name: "trophy prize win champion award 1st first gold", category: "activities" },
  { emoji: "🥇", name: "1st place medal gold first winner champion", category: "activities" },
  { emoji: "🥈", name: "2nd place medal silver second runner up", category: "activities" },
  { emoji: "🥉", name: "3rd place medal bronze third place", category: "activities" },

  // Travel & Places
  { emoji: "🚗", name: "automobile car red drive travel vehicle road", category: "travel" },
  { emoji: "🚕", name: "taxi yellow cab uber ride vehicle", category: "travel" },
  { emoji: "🏎️", name: "racing car race f1 formula speed fast", category: "travel" },
  { emoji: "🚓", name: "police car cop siren patrol law 911", category: "travel" },
  { emoji: "🚑", name: "ambulance emergency rescue medical 911 hospital", category: "travel" },
  { emoji: "🚒", name: "fire engine truck emergency 911 firefighter", category: "travel" },
  { emoji: "🚲", name: "bicycle bike cycle ride pedal fitness", category: "travel" },
  { emoji: "🛵", name: "motor scooter moped vespa drive commute", category: "travel" },
  { emoji: "🏍️", name: "motorcycle motorbike biker speed fast", category: "travel" },
  { emoji: "🚨", name: "police car light beacon siren alarm emergency", category: "travel" },
  { emoji: "✈️", name: "airplane plane fly flight airport vacation travel", category: "travel" },
  { emoji: "🚀", name: "rocket space ship launch speed blast off crypto", category: "travel" },
  { emoji: "🛸", name: "flying saucer ufo alien extraterrestrial", category: "travel" },
  { emoji: "🚁", name: "helicopter chopper fly air transport", category: "travel" },
  { emoji: "⛵️", name: "sailboat boat sea ocean wind sail water", category: "travel" },
  { emoji: "🏖️", name: "beach with umbrella vacation summer sand ocean", category: "travel" },
  { emoji: "🏝️", name: "desert island tropical beach ocean paradise", category: "travel" },
  { emoji: "🏕️", name: "camping tent outdoors forest nature bonfire", category: "travel" },
  { emoji: "🏠", name: "house home building resident property", category: "travel" },
  { emoji: "🏢", name: "office building work business corporate city", category: "travel" },
  { emoji: "🏰", name: "castle fortress fairytale royalty medieval", category: "travel" },

  // Symbols & Objects
  { emoji: "💯", name: "hundred points 100 score perfect complete exam", category: "symbols" },
  { emoji: "💢", name: "anger symbol mad angry anime vein", category: "symbols" },
  { emoji: "💥", name: "collision bang boom explosion blast pow", category: "symbols" },
  { emoji: "💫", name: "dizzy star swirl spark magical", category: "symbols" },
  { emoji: "💬", name: "speech balloon chat message talk text bubble", category: "symbols" },
  { emoji: "💭", name: "thought balloon think daydream bubble", category: "symbols" },
  { emoji: "💤", name: "zzz sleep snoring tired rest bed", category: "symbols" },
  { emoji: "⚠️", name: "warning sign alert caution hazard danger", category: "symbols" },
  { emoji: "⛔️", name: "no entry stop sign forbidden ban", category: "symbols" },
  { emoji: "🚫", name: "prohibited sign no forbidden ban restrict", category: "symbols" },
  { emoji: "✅", name: "check mark button green pass yes complete correct", category: "symbols" },
  { emoji: "❌", name: "cross mark red x wrong no cancel delete", category: "symbols" },
  { emoji: "❓", name: "red question mark ask what confusion query", category: "symbols" },
  { emoji: "❗️", name: "red exclamation mark alert surprise warning important", category: "symbols" },
  { emoji: "💡", name: "light bulb idea smart creative think inspiration", category: "symbols" },
  { emoji: "💰", name: "money bag cash dollar wealthy rich prize", category: "symbols" },
  { emoji: "💵", name: "dollar banknote cash money payment bill", category: "symbols" },
  { emoji: "💎", name: "gem stone diamond jewelry precious expensive luxury", category: "symbols" },
  { emoji: "🔑", name: "key unlock lock password security access secret", category: "symbols" },
  { emoji: "🔒", name: "locked padlock secure privacy safe", category: "symbols" },
  { emoji: "🔔", name: "bell notification alert ring chime subscribe", category: "symbols" },
  { emoji: "📱", name: "mobile phone smartphone iphone android tech device", category: "symbols" },
  { emoji: "💻", name: "laptop computer macbook pc tech work coding", category: "symbols" },
  { emoji: "📸", name: "camera with flash photo photography picture capture", category: "symbols" },
  { emoji: "🎉", name: "party popper confetti celebrate congratulations party", category: "symbols" },
  { emoji: "🎁", name: "wrapped gift present birthday surprise box ribbon", category: "symbols" },
];

const DEFAULT_RECENTS = ["😂", "❤️", "🔥", "👍", "😍", "😭", "🙏", "✨", "🥰", "🎉", "💀", "🥺", "😊", "💯", "👏", "😎"];

interface CustomEmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onEmojiSelected: (emoji: { emoji: string }) => void;
}

export default function CustomEmojiPicker({ open, onClose, onEmojiSelected }: CustomEmojiPickerProps) {
  const { theme } = useTheme();
  const isAmoled = theme.id === "black";
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("smileys");
  const [recentEmojis, setRecentEmojis] = useState<string[]>(DEFAULT_RECENTS);

  useEffect(() => {
    if (open) {
      AsyncStorage.getItem("recent_emojis").then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setRecentEmojis(parsed);
            }
          } catch (e) {}
        }
      });
      setSearchQuery("");
    }
  }, [open]);

  const handleSelectEmoji = useCallback((emoji: string) => {
    onEmojiSelected({ emoji });
    setRecentEmojis((prev) => {
      const updated = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 32);
      AsyncStorage.setItem("recent_emojis", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, [onEmojiSelected]);

  const filteredEmojis = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return EMOJI_DATABASE.filter(
        (item) => item.name.toLowerCase().includes(q) || item.emoji.includes(q)
      );
    }
    if (activeCategory === "recent") {
      return recentEmojis.map((emoji) => {
        const found = EMOJI_DATABASE.find((item) => item.emoji === emoji);
        return found || { emoji, name: "recent emoji", category: "recent" };
      });
    }
    return EMOJI_DATABASE.filter((item) => item.category === activeCategory);
  }, [searchQuery, activeCategory, recentEmojis]);

  if (!open) return null;

  const bg = isAmoled ? "#000000" : (theme.id === "light" ? "#ffffff" : theme.id === "pink" ? "#fdf2f8" : "#2b2d31");
  const headerBg = isAmoled ? "#0a0a0a" : (theme.id === "light" ? "#f3f4f6" : theme.id === "pink" ? "#fce7f3" : "#1e1f22");
  const searchInputBg = isAmoled ? "#141414" : (theme.id === "light" ? "#e5e7eb" : theme.id === "pink" ? "#fbcfe8" : "#383a40");
  const textColor = isAmoled ? "#ffffff" : ((theme.id === "light" || theme.id === "pink") ? "#111111" : "#f2f3f5");
  const textMuted = isAmoled ? "#888888" : theme.textMuted;
  const borderColor = isAmoled ? "#222222" : (theme.id === "light" ? "#e5e7eb" : theme.id === "pink" ? "#fbcfe8" : "#383a40");

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        
        <View style={[styles.drawerContainer, { backgroundColor: bg, borderColor }]}>
          {/* Top handle bar */}
          <View style={styles.handleBarWrapper}>
            <View style={[styles.handleBar, { backgroundColor: isAmoled ? "#444" : textMuted }]} />
          </View>

          {/* Search bar & Close */}
          <View style={[styles.searchRow, { borderBottomColor: borderColor }]}>
            <View style={[styles.searchInputWrapper, { backgroundColor: searchInputBg }]}>
              <Search size={18} color={textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: textColor }]}
                placeholder="Search emojis..."
                placeholderTextColor={textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                  <X size={16} color={textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: headerBg }]}>
              <X size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          {!searchQuery && (
            <View style={[styles.categoryBar, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catTab,
                        isActive && [styles.catTabActive, { backgroundColor: isAmoled ? "#222" : theme.accent }],
                      ]}
                      onPress={() => setActiveCategory(cat.id)}
                    >
                      <Icon size={18} color={isActive ? "#ffffff" : textMuted} />
                      <Text
                        style={[
                          styles.catLabel,
                          { color: isActive ? "#ffffff" : textMuted },
                          isActive && { fontWeight: "700" },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Emojis Grid */}
          <FlatList
            data={filteredEmojis}
            keyExtractor={(item, index) => `${item.emoji}-${index}`}
            numColumns={8}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.emojiGrid}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: textMuted }]}>No emojis found for "{searchQuery}"</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.emojiCell}
                activeOpacity={0.6}
                onPress={() => handleSelectEmoji(item.emoji)}
              >
                <Text style={styles.emojiText}>{item.emoji}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  drawerContainer: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 680 : "100%",
    height: Platform.OS === "web" ? Math.min(SCREEN_HEIGHT * 0.65, 480) : SCREEN_HEIGHT * 0.58,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBarWrapper: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
    outlineStyle: "none" as any,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryBar: {
    borderBottomWidth: 1,
  },
  categoryScroll: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    alignItems: "center",
  },
  catTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  catTabActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  catLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  emojiGrid: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  emojiCell: {
    flex: 1 / 8,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
    borderRadius: 8,
  },
  emojiText: {
    fontSize: Platform.OS === "web" ? 28 : 26,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
