const express = require('express');
const router = express.Router();

router.get('/clientC', (req, res) => {
    res.send('Endpoints for Client C');
});

module.exports = router;
