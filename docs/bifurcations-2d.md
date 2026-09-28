# Bifurcations in two dimensions

Open `dist/apps/bifurcations-2d/index.html`, or use its card on the main page. The illustrated family is

**x′ = x² − y² + 1, y′ = y − x² − a.**

Changing a moves the equilibria and can change the connections between saddle trajectories. Nullclines and saddle separatrices reveal different parts of this geometry.

## Nullclines and equilibria

The **x-nullcline** is y = ±√(x² + 1), where the vector field is vertical. The **y-nullcline** is y = x² + a, where it is horizontal. Their intersections are equilibria; a nullcline itself is generally not a trajectory.

Let y± = (1 ± √(5 − 4a))/2. Each real y± with |y±| ≥ 1 gives equilibria x = ±√(y±² − 1), counting x = 0 once. The Jacobian is

```text
J(x,y) = [  2x   −2y ]
         [ −2x     1 ]
```

Its trace is 2x + 1 and determinant is 2x(1 − 2y). The upper-right and lower-left equilibria are saddles whenever present; the lower-right equilibrium is a source. The upper-left equilibrium changes stability at the Hopf value below.

| Parameter | Number of equilibria |
| --- | ---: |
| a < −1 | 4 |
| a = −1 | 3 |
| −1 < a < 1 | 2 |
| a = 1 | 1 |
| a > 1 | 0 |

The **saddle-node bifurcations** occur exactly at a = −1, at (0, −1), and a = 1, at (0, 1). In each case the Jacobian has eigenvalues 0 and 1.

## Saddle connections

A saddle's **stable separatrices** approach it in forward time; its **unstable separatrices** leave it. An orbit connecting two different saddles is heteroclinic. An orbit leaving and returning to the same saddle is homoclinic. These connections are global features and cannot be found from eigenvalues alone.

### Exact heteroclinic connection

Let m be the positive real root of m³ − m − 1 = 0, so m ≈ 1.324717957244746. Then

**a_het = −m − 1/(4m) ≈ −1.513437373806419.**

At this parameter the line y = mx − 1/(2m) contains a heteroclinic orbit from the lower-left saddle (−0.592518688, −1.162358979) to the upper-right saddle (1.917236645, 2.162358979).

This is an exact algebraic result. Define L = y − mx + 1/(2m). Direct substitution gives

**L′ = 2m²xL + mL² + a_het − a.**

Thus L = 0 is invariant at a = a_het. On the segment between the saddles, x′ > 0, establishing the stated direction of travel.

### Numerically located homoclinic loop

The upper-right saddle has a homoclinic loop at the numerical estimate

**a_hom ≈ 0.7228957882244.**

To locate it, follow the inward unstable branch forward and the inward stable branch backward, starting a small distance from the saddle along the corresponding eigenvectors. Compare their x-coordinates where they meet the transverse section y = y_s, x < −x_s, with (x_s, y_s) the upper-right saddle. The difference vanishes at a connection. Both branches meet near x = −1.176106858018.

Shooting uses adaptive RK4 with step doubling, Richardson extrapolation, and refinement of the section crossing. Refinement with seed distances 10⁻⁶ and 10⁻⁷ and scaled integration tolerances 10⁻¹² and 10⁻¹³ gives consistent results; a final numerical bracket was [0.7228957882241956, 0.7228957882245595]. This is a convergence check, not a rigorous interval proof or an exact parameter formula.

The displayed loop joins the two computed halves at the transverse section. Integrating a single trajectory forward all the way back to the saddle would magnify roundoff in its unstable direction. The saddle trace is positive, consistent with a repelling loop and an unstable periodic orbit on the side toward the Hopf bifurcation.

## Subcritical Hopf bifurcation

The upper-left equilibrium has a Hopf bifurcation at

**a_H = √5/2 − 1/4 ≈ 0.868033988749895**, at **(−1/2, √5/2)**.

Its eigenvalues are ±i√(√5 − 1). The equilibrium is stable below a_H and unstable above. The Hopf bifurcation is **subcritical**: a small unstable periodic orbit lies on the a < a_H side and contracts into the equilibrium as a increases to a_H.

For a sign check, write u = x + 1/2, v = y − √5/2, ω² = √5 − 1, U = v, and V = −(u + v)/ω. At the Hopf parameter,

```text
U′ = −ωV − (U + ωV)²
V′ =  ωU + U²/ω
```

The planar first Lyapunov coefficient in these coordinates is (5√5 + 1)/16 > 0. The rotation-coordinate formula used for this calculation is given in the [Utrecht University normal-form notes, §3.1.2](https://webspace.science.uu.nl/~hanss102/inlds225/Normal_form.pdf).

The highlighted parameter values describe the displayed local bifurcations and saddle connections. Finite numerical trajectories and parameter scans alone do not establish an exhaustive classification for every real a.
