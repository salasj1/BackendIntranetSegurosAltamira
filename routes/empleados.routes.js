import { Router } from "express";

const router = Router();

router.get("/empleados", (req, res) => {
    res.json({ message: "Lista de empleados" });
});

router.get("/empleados/:id", (req, res) => {
    res.json({ message: "Empleado con id: " + req.params.id });
});

router.post("/empleados", (req, res) => {
    res.json({ message: "Empleado creado" });
});

router.put("/empleados/:id", (req, res) => {
    res.json({ message: "Empleado actualizado" });
});

router.delete("/empleados/:id", (req, res) => {
    res.json({ message: "Empleado eliminado" });
});

export default router;