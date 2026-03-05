router.post(
  "/signup",
  upload.fields([
    { name: "licenseFront", maxCount: 1 },
    { name: "licenseBack", maxCount: 1 },
    { name: "rcFront", maxCount: 1 },
    { name: "rcBack", maxCount: 1 },
    { name: "insurance", maxCount: 1 },
    { name: "idFront", maxCount: 1 },
    { name: "idBack", maxCount: 1 },
    { name: "profilePhoto", maxCount: 1 }
  ]),
  async (req, res) => {
    try {

      const {
        name,
        phone,
        email,
        password,
        address,
        vehicleNumber,
        vehicleType,
        licenseNumber
      } = req.body;

      const existingDriver = await Driver.findOne({ email });

      if (existingDriver) {
        return res.status(400).json({ message: "Driver already exists" });
      }

      if (
        !req.files?.licenseFront ||
        !req.files?.licenseBack ||
        !req.files?.rcFront ||
        !req.files?.rcBack ||
        !req.files?.insurance ||
        !req.files?.idFront ||
        !req.files?.idBack ||
        !req.files?.profilePhoto
      ) {
        return res.status(400).json({ message: "All documents are required" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const driver = new Driver({
        name,
        phone,
        email,
        password: hashedPassword,
        address,
        vehicleNumber,
        vehicleType,
        licenseNumber,

        licenseFront: req.files.licenseFront[0].path,
        licenseBack: req.files.licenseBack[0].path,

        rcFront: req.files.rcFront[0].path,
        rcBack: req.files.rcBack[0].path,

        insurance: req.files.insurance[0].path,

        idFront: req.files.idFront[0].path,
        idBack: req.files.idBack[0].path,

        profilePhoto: req.files.profilePhoto[0].path,

        status: "pending"
      });

      const shortId = driver._id.toString().slice(-6).toUpperCase();
      driver.driverId = `ASAN-${shortId}`;

      await driver.save();

      const token = jwt.sign(
        { id: driver._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        message: "Signup successful",
        token,
        driver
      });

    } catch (error) {
      console.error("Signup Error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  }
);
