import { Typography, Box } from '@mui/material';

const Header = () => {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      height={64} // Adjust height as needed
      borderBottom="1px solid #333"
    >
      <Typography variant="h4">Norbert</Typography>
    </Box>
  );
};

export default Header;