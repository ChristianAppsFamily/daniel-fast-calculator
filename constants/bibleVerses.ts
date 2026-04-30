export interface BibleVerse {
  text: string;
  reference: string;
}

export const FASTING_VERSES: BibleVerse[] = [
  {
    text: "When you fast, do not look somber as the hypocrites do, but put oil on your head and wash your face.",
    reference: "Matthew 6:16-17"
  },
  {
    text: "Is not this the kind of fasting I have chosen: to loose the chains of injustice?",
    reference: "Isaiah 58:6"
  },
  {
    text: "Yet even now, declares the Lord, return to me with all your heart, with fasting, with weeping.",
    reference: "Joel 2:12"
  },
  {
    text: "Jesus answered, 'It is written: Man shall not live on bread alone, but on every word from God.'",
    reference: "Luke 4:4"
  },
  {
    text: "When you fast, put oil on your head and wash your face, so that it will not be obvious to others.",
    reference: "Matthew 6:17-18"
  },
  {
    text: "I humbled myself with fasting, and my prayer returned to my own heart.",
    reference: "Psalm 35:13"
  },
  {
    text: "So we fasted and petitioned our God about this, and he answered our prayer.",
    reference: "Ezra 8:23"
  },
  {
    text: "While they were worshiping the Lord and fasting, the Holy Spirit said, 'Set apart for me...'",
    reference: "Acts 13:2"
  },
  {
    text: "After fasting forty days and forty nights, he was hungry.",
    reference: "Matthew 4:2"
  },
  {
    text: "Then I set my face toward the Lord God to make request by prayer and supplications, with fasting.",
    reference: "Daniel 9:3"
  },
  {
    text: "Consecrate a fast; call a sacred assembly.",
    reference: "Joel 1:14"
  },
  {
    text: "This kind can come out by nothing but prayer and fasting.",
    reference: "Mark 9:29"
  },
  {
    text: "I ate no pleasant food, no meat or wine came into my mouth.",
    reference: "Daniel 10:3"
  },
  {
    text: "So I turned to the Lord God and pleaded with him in prayer and petition, in fasting.",
    reference: "Daniel 9:3"
  },
  {
    text: "But you, when you fast, anoint your head and wash your face.",
    reference: "Matthew 6:17"
  },
  {
    text: "Then the disciples came to Jesus privately and said, 'Why could we not cast it out?'",
    reference: "Matthew 17:19"
  },
  {
    text: "Discipline your body and keep it under control.",
    reference: "1 Corinthians 9:27"
  },
  {
    text: "But the days will come when the bridegroom will be taken away from them, and then they will fast.",
    reference: "Matthew 9:15"
  },
  {
    text: "She never left the temple but worshiped night and day, fasting and praying.",
    reference: "Luke 2:37"
  },
  {
    text: "I ate no choice food; no meat or wine touched my lips.",
    reference: "Daniel 10:3"
  },
  {
    text: "Blow the trumpet in Zion, declare a holy fast, call a sacred assembly.",
    reference: "Joel 2:15"
  },
  {
    text: "And whenever you fast, do not look dismal, like the hypocrites.",
    reference: "Matthew 6:16"
  },
  {
    text: "While they were ministering to the Lord and fasting, the Holy Spirit said...",
    reference: "Acts 13:2"
  },
  {
    text: "I proclaim a fast, so that we might humble ourselves before our God.",
    reference: "Ezra 8:21"
  },
  {
    text: "Then they fasted that day until evening.",
    reference: "Judges 20:26"
  },
  {
    text: "Then David took hold of his clothes and tore them, and so did all the men with him; they mourned and wept and fasted.",
    reference: "2 Samuel 1:11-12"
  },
  {
    text: "So Saul died for his unfaithfulness; he was unfaithful to the Lord.",
    reference: "1 Chronicles 10:13"
  },
  {
    text: "They devoted themselves to the apostles' teaching and to fellowship, to the breaking of bread and to prayer.",
    reference: "Acts 2:42"
  },
  {
    text: "Seek the Lord while he may be found; call on him while he is near.",
    reference: "Isaiah 55:6"
  },
  {
    text: "Draw near to God and He will draw near to you.",
    reference: "James 4:8"
  },
  {
    text: "Blessed are those who hunger and thirst for righteousness, for they will be filled.",
    reference: "Matthew 5:6"
  },
  {
    text: "The Lord is close to the brokenhearted and saves those who are crushed in spirit.",
    reference: "Psalm 34:18"
  },
  {
    text: "Create in me a pure heart, O God, and renew a steadfast spirit within me.",
    reference: "Psalm 51:10"
  },
  {
    text: "I can do all things through Christ who strengthens me.",
    reference: "Philippians 4:13"
  },
  {
    text: "Trust in the Lord with all your heart and lean not on your own understanding.",
    reference: "Proverbs 3:5"
  }
];

export function getDailyVerse(): BibleVerse {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = dayOfYear % FASTING_VERSES.length;
  return FASTING_VERSES[index];
}
