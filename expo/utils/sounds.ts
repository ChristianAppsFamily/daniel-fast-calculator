import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let startSound: Audio.Sound | null = null;
let completionSound: Audio.Sound | null = null;

const SOFT_START_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';
const COMPLETION_CHIME = 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3';

export async function playStartSound(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('Start sound skipped on web');
    return;
  }

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    });

    if (startSound) {
      await startSound.unloadAsync();
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: SOFT_START_SOUND },
      { volume: 0.3, shouldPlay: true }
    );
    startSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        startSound = null;
      }
    });

    console.log('Start sound played');
  } catch (error) {
    console.log('Error playing start sound:', error);
  }
}

export async function playCompletionSound(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('Completion sound skipped on web');
    return;
  }

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    });

    if (completionSound) {
      await completionSound.unloadAsync();
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: COMPLETION_CHIME },
      { volume: 0.4, shouldPlay: true }
    );
    completionSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        completionSound = null;
      }
    });

    console.log('Completion sound played');
  } catch (error) {
    console.log('Error playing completion sound:', error);
  }
}

export async function cleanupSounds(): Promise<void> {
  try {
    if (startSound) {
      await startSound.unloadAsync();
      startSound = null;
    }
    if (completionSound) {
      await completionSound.unloadAsync();
      completionSound = null;
    }
  } catch (error) {
    console.log('Error cleaning up sounds:', error);
  }
}
