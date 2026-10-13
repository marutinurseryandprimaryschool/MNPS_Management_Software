/* ============================================
   The school's teacher allocation, as written on the sheets
   ============================================
   Transcribed from the handwritten allocation the school supplied, so the
   Admin can import it instead of typing ~60 rows. It is a STARTING POINT
   offered to the import screen — nothing here reaches the database until the
   Admin has reviewed the matches and pressed Confirm.

   Names are exactly as written on the sheets. Where a sheet's spelling
   differs from the teacher record ("Murugabekhi", "Swarnalatha"), the import
   deliberately refuses to guess: the row lands in Needs Review with the
   closest names offered, and a person decides.

   PRE-KG is absent on purpose. Its allocation was not legible on the sheets
   provided, and inventing one would put a teacher in front of a class on the
   strength of a guess. Add it through the normal Add Subject form.
*/

export const ALLOCATION_SHEET = `CLASS I-A
English -> Uma
Tamil -> Revathy
Maths -> Swarnalatha
EVS -> Kohila
Computer -> Kohila
GK -> Revathy
Hindi -> Swarnalatha

CLASS I-B
English -> Murugabekhi
Tamil -> Abisha
Maths -> Prabha
EVS -> Kaleeswari
Computer -> Kaleeswari
GK -> Abisha
Hindi -> Prabha

UKG-A
English -> Anusha
Tamil -> Revathy
Maths -> Meena
EVS -> Meena
Physical Education -> Athilakshmi
Story -> Athilakshmi
GK -> Athilakshmi

LKG-A
English -> Abisha
Tamil -> Prabha
Maths -> Athilakshmi
EVS -> Athilakshmi
Rhymes -> Revathy
Story -> Revathy
GK -> Revathy

LKG-B
English -> Meena
Tamil -> Kaleeswari
Maths -> Uma
EVS -> Uma
Rhymes -> Murugabekhi
Story -> Murugabekhi
GK -> Murugabekhi

CLASS II-A
English -> Athilakshmi
Tamil -> Murugabekhi
Maths -> Prabha
EVS -> Abisha
Computer -> Murugabekhi
GK -> Abisha
Hindi -> Prabha

CLASS II-B
English -> Abisha
Tamil -> Meena
Maths -> Kohila
EVS -> Swarnalatha
Computer -> Meena
GK -> Kohila
Hindi -> Swarnalatha

CLASS IV-A
English -> Kaleeswari
Tamil -> Meena
Maths -> Anusha
Science -> Meena
Social -> Murugabekhi
Hindi -> Anusha
Computer -> Murugabekhi
GK -> Kaleeswari

CLASS V-A
English -> Anusha
Tamil -> Uma
Maths -> Kohila
Science -> Kaleeswari
Social -> Uma
Hindi -> Kohila
Computer -> Kaleeswari
GK -> Anusha
`;
