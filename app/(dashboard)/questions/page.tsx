import { TeacherSubjectGrade } from '@/components/questions/TeacherSubjectGrade'

export default function QuestionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 pt-4 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Blackboard Questions</h1>
        <p className="text-sm text-gray-500 mt-0.5">AI-generated questions — read from phone onto board</p>
      </div>
      <div className="px-4 py-4">
        <TeacherSubjectGrade />
      </div>
    </div>
  )
}
