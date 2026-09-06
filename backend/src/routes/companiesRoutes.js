const express = require("express");
const { listCompanies, discoverCompanies, deleteCompany } = require("../controllers/companiesController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", listCompanies);
router.post("/discover", discoverCompanies);
router.delete("/:id", deleteCompany);

module.exports = router;
