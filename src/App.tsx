import { Box, CssBaseline, Typography } from '@mui/material';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

const App = () => {
  return (
    <>
      <CssBaseline />
      <Box
        display="flex"
        height="100vh"
        bgcolor="#131321" // Your desired background color
        color="white"
      >
        <Sidebar />
        <Box flex={1}>
          <Header />
        </Box>
      </Box>
    </>
  );
};

export default App;