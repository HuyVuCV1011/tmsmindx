import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define the shape of our data (must handle undefined links if link data is sensitive)
interface TrainingState {
  currentVideoId: number | null;
  videoLink: string | null;
  duration: number;
  title: string | null;
}

const initialState: TrainingState = {
  currentVideoId: null,
  videoLink: null,
  duration: 0,
  title: null,
};

export const trainingSlice = createSlice({
  name: 'training',
  initialState,
  reducers: {
    setVideo: (state, action: PayloadAction<{ id: number; link: string; duration: number; title: string }>) => {
      state.currentVideoId = action.payload.id;
      // If we want to hide the full link or manipulate it before storing
      state.videoLink = action.payload.link; 
      state.duration = action.payload.duration;
      state.title = action.payload.title;
    },
    clearVideo: (state) => {
      state.currentVideoId = null;
      state.videoLink = null;
      state.duration = 0;
      state.title = null;
    },
  },
});

export const { setVideo, clearVideo } = trainingSlice.actions;

export default trainingSlice.reducer;
